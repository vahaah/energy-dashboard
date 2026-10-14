import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPricesQueryParams } from "@/lib/dashboard-data";
import { resetRedisClient, setRedisForTests, type RedisCommands } from "@/lib/redis-cache";
import { readTinybirdOps, resetTinybirdOpsMemoryForTests } from "@/lib/tinybird-ops";
import * as tinybird from "@/lib/tinybird";
import { storeWarmedRows } from "@/lib/warm-envelope";
import { LIVE_PIPES, LONG_PIPES } from "@/lib/warm-pipes";
import {
  readWorkflowBody,
  resetWorkflowBodyMemoryForTests,
  writeWorkflowBody,
} from "@/lib/workflow-body";
import { takeWorkflowSlot } from "@/lib/workflow-slot";
import { postPricesStep } from "@/workflows/steps/prices";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => () => fn(),
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

class MemoryRedis implements RedisCommands {
  readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= Date.now()) {
      return null;
    }
    return hit.value as T;
  }

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean }
  ): Promise<"OK" | null> {
    const existing = this.store.get(key);
    if (opts?.nx && existing && existing.expiresAt > Date.now()) {
      return null;
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (opts?.ex ?? 60) * 1000,
    });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    const next = Number((await this.get<number | string>(key)) ?? 0) + 1;
    await this.set(key, next, { ex: 86_400 });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= Date.now()) {
      return 0;
    }
    hit.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

const now = new Date("2026-10-14T12:00:00.000Z");
const savedReadToken = process.env.TINYBIRD_READ_TOKEN;

function pipeById(id: string) {
  const pipe = [...LIVE_PIPES, ...LONG_PIPES].find((candidate) => candidate.id === id);
  if (!pipe) {
    throw new Error(`missing warm pipe ${id}`);
  }
  return pipe;
}

function mockPipe(data: unknown[]) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

describe("codex review fixes", () => {
  const redis = new MemoryRedis();

  beforeEach(() => {
    redis.store.clear();
    setRedisForTests(redis);
    resetTinybirdOpsMemoryForTests();
    resetWorkflowBodyMemoryForTests();
    process.env.TINYBIRD_READ_TOKEN = savedReadToken ?? "test-read-token";
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetRedisClient();
    resetTinybirdOpsMemoryForTests();
    resetWorkflowBodyMemoryForTests();
    if (savedReadToken === undefined) {
      delete process.env.TINYBIRD_READ_TOKEN;
    } else {
      process.env.TINYBIRD_READ_TOKEN = savedReadToken;
    }
    vi.restoreAllMocks();
  });

  it("runs the slot and the rolling read when Redis is unset", async () => {
    resetRedisClient();
    await takeWorkflowSlot("electricity", "2026-10-14T12:00:00.000Z", "owner-a");
    await takeWorkflowSlot("electricity", "2026-10-14T12:00:00.000Z", "owner-b");
    expect(console.warn).toHaveBeenCalledWith("[workflow] redis unset; slot lock skipped");

    const fetchSpy = mockPipe([{ timestamp: "2026-10-14 11:00:00" }]);
    const rows = await tinybird.queryPipe(
      "snapshots_range",
      { start: "2026-10-13 12:00:00", end: "2026-10-14 12:00:00" },
      { range: "24h", now }
    );

    expect(rows).toEqual([{ timestamp: "2026-10-14 11:00:00" }]);
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v0/pipes/snapshots_range.json");
    expect(url.searchParams.get("start")).toBe("2026-10-13 12:00:00");
    expect(await readTinybirdOps(now)).toBe(0);

    const stored = await storeWarmedRows(
      pipeById("snapshots_range:24h"),
      pipeById("snapshots_range:24h").params(now),
      [{ timestamp: "2026-10-14 11:00:00" }],
      now
    );
    expect(stored.ok).toBe(true);

    await writeWorkflowBody("prices", "slot", "eia", { source: "eia", ok: true, rows: [] });
    await expect(readWorkflowBody("prices", "slot", "eia")).resolves.toEqual({
      source: "eia",
      ok: true,
      rows: [],
    });
  });

  it("slices a past day out of the warmed envelope", async () => {
    const snapshots7d = pipeById("snapshots_range:7d");
    const day = { timestamp: "2026-10-13 00:30:00", demand_mw: 28_000 };
    await storeWarmedRows(
      snapshots7d,
      snapshots7d.params(now),
      [day, { timestamp: "2026-10-13 23:30:00", demand_mw: 29_000 }],
      now
    );
    const fetchSpy = mockPipe([]);

    const rows = await tinybird.queryPipe(
      "snapshots_range",
      { start: "ignored", end: "ignored" },
      { range: "24h", date: "2026-10-13", now }
    );

    expect(rows).toEqual([day]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await readTinybirdOps(now)).toBe(0);
  });

  it("does not fetch when the warmed day slice is empty", async () => {
    const snapshots7d = pipeById("snapshots_range:7d");
    await storeWarmedRows(
      snapshots7d,
      snapshots7d.params(now),
      [{ timestamp: "2026-10-14 11:00:00", demand_mw: 30_000 }],
      now
    );
    const fetchSpy = mockPipe([]);

    const rows = await tinybird.queryPipe("snapshots_range", undefined, {
      range: "24h",
      date: "2026-10-13",
      now,
    });

    expect(rows).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await readTinybirdOps(now)).toBe(0);
  });

  it("falls back to one budgeted civil-day read and reuses the long cache", async () => {
    const fetched = [{ timestamp: "2020-01-01 12:00:00", demand_mw: 1 }];
    const fetchSpy = mockPipe(fetched);

    const first = await tinybird.queryPipe(
      "snapshots_range",
      { start: "ignored", end: "ignored" },
      { range: "24h", date: "2020-01-01", now }
    );
    const second = await tinybird.queryPipe(
      "snapshots_range",
      { start: "ignored", end: "ignored" },
      { range: "24h", date: "2020-01-01", now }
    );

    expect(first).toEqual(fetched);
    expect(second).toEqual(fetched);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(url.searchParams.get("start")).toBe("2020-01-01 00:00:00");
    expect(url.searchParams.get("end")).toBe("2020-01-01 23:59:59");
    expect(await readTinybirdOps(now)).toBe(1);
    expect(
      [...redis.store.keys()].some((key) => key.includes("tb:hist-day:snapshots_range:2020-01-01"))
    ).toBe(true);
  });

  it("keeps a rolling miss off Tinybird", async () => {
    const fetchSpy = mockPipe([]);
    await expect(
      tinybird.queryPipe("snapshots_range", { start: "a", end: "b" }, { range: "24h", now })
    ).rejects.toBeInstanceOf(tinybird.WarmedEnvelopeMissing);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await readTinybirdOps(now)).toBe(0);
  });

  it("filters a commodity from the full warmed prices envelope", async () => {
    const prices = pipeById("prices_range:30d");
    const brent = {
      date: "2026-10-01",
      commodity: "brent_crude",
      price: 70,
      currency: "USD",
      unit: "$/BBL",
    };
    const lng = {
      date: "2026-10-01",
      commodity: "lng_asia",
      price: 10,
      currency: "USD",
      unit: "$/MMBTU",
    };
    await storeWarmedRows(prices, prices.params(now), [brent, lng], now);
    const fetchSpy = mockPipe([]);

    const rows = await tinybird.queryPipe(
      "prices_range",
      { ...getPricesQueryParams("30d", now), commodity: "brent_crude" },
      { range: "30d", now }
    );

    expect(rows).toEqual([brent]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the rows that succeeded and fails the step when EIA fails", async () => {
    const slot = "2026-10-14T00:30:00.000Z";
    const sap = {
      date: "2026-10-13",
      commodity: "gb_gas_sap",
      price: 3.2,
      currency: "GBP",
      unit: "p/kWh",
    };
    await writeWorkflowBody("prices", slot, "eia", {
      source: "eia",
      ok: false,
      rows: [],
      error: "eia down",
    });
    await writeWorkflowBody("prices", slot, "worldbank", {
      source: "worldbank",
      ok: true,
      rows: [],
    });
    await writeWorkflowBody("prices", slot, "nationalgas", {
      source: "nationalgas",
      ok: true,
      rows: [sap],
    });
    const ingest = vi.spyOn(tinybird, "ingestRows").mockResolvedValue({ successful_rows: 1 });

    const posted = await postPricesStep(slot, now.toISOString());

    expect(posted.ok).toBe(false);
    expect(posted.rows).toBe(1);
    expect(ingest).toHaveBeenCalledWith("commodity_prices", [sap]);
    expect(console.error).toHaveBeenCalledWith(
      "[workflow] prices required source failed",
      expect.objectContaining({
        sources: expect.arrayContaining([
          expect.objectContaining({ source: "eia", ok: false, error: "eia down" }),
        ]),
      })
    );
  });

  it("leaves the prices step successful when only National Gas fails", async () => {
    const slot = "2026-10-14T00:30:00.000Z";
    await writeWorkflowBody("prices", slot, "eia", { source: "eia", ok: true, rows: [] });
    await writeWorkflowBody("prices", slot, "worldbank", {
      source: "worldbank",
      ok: true,
      rows: [],
    });
    await writeWorkflowBody("prices", slot, "nationalgas", {
      source: "nationalgas",
      ok: false,
      rows: [],
      error: "sap down",
    });
    const ingest = vi.spyOn(tinybird, "ingestRows").mockResolvedValue({ successful_rows: 0 });

    const posted = await postPricesStep(slot, now.toISOString());

    expect(posted.ok).toBe(true);
    expect(ingest).not.toHaveBeenCalled();
  });
});
