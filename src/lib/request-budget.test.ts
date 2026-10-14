import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dropComposedDashboardPayloads, publishAfterSuccess } from "@/lib/cache-warm";
import { loadDashboardPayload } from "@/lib/dashboard-payload";
import { loadHomepagePayload } from "@/lib/homepage-payload";
import { peekOgCacheSnapshot } from "@/lib/og/peek";
import { resetRedisClient, setRedisForTests, type RedisCommands } from "@/lib/redis-cache";
import { clearTinybirdLastGood } from "@/lib/tinybird-cache";
import * as tinybird from "@/lib/tinybird";
import { LIVE_PIPES } from "@/lib/warm-pipes";
import { storeWarmedRows } from "@/lib/warm-envelope";
import { GET as health } from "@/app/api/health/route";

vi.mock("@vercel/functions", () => ({
  dangerouslyDeleteByTag: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => () => fn(),
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

vi.mock("@/lib/forecasts", () => ({
  getLookAhead: vi.fn(async () => {
    throw new Error("look-ahead stays off the request path");
  }),
}));

vi.mock("@/lib/neso-historic", () => ({
  NESO_HISTORIC_CACHE_TAG: "neso-historic",
  getHistoricPeriodView: vi.fn(async () => {
    throw new Error("neso stays off the request path");
  }),
  getGridRecords: vi.fn(async () => {
    throw new Error("neso stays off the request path");
  }),
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

const snapshots24h = LIVE_PIPES[0];

describe("request path Tinybird budget", () => {
  const redis = new MemoryRedis();

  beforeEach(() => {
    redis.store.clear();
    setRedisForTests(redis);
  });

  afterEach(() => {
    resetRedisClient();
    vi.restoreAllMocks();
  });

  it("does not call fetchPipeRows for a primed page view or health check", async () => {
    const now = new Date();
    const stamp = new Date(now.getTime() - 90 * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    await storeWarmedRows(
      snapshots24h,
      snapshots24h.params(now),
      [{ timestamp: stamp, demand_mw: 32_000 }],
      now
    );
    const fetchPipeRows = vi.spyOn(tinybird, "fetchPipeRows");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));

    const payload = await loadHomepagePayload();
    const response = await health();

    expect(payload?.facts.referenceTimestamp).toBe(stamp);
    expect(response.status).toBe(200);
    expect(fetchPipeRows).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("moves data-as-of only after the envelope is published", async () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    const first = "2026-10-14 11:00:00";
    const second = "2026-10-14 11:30:00";

    async function stamp(): Promise<string | null> {
      const payload = await loadDashboardPayload({ period: "day", now });
      return payload.facts.referenceTimestamp;
    }

    await storeWarmedRows(
      snapshots24h,
      snapshots24h.params(now),
      [{ timestamp: first, demand_mw: 30_000 }],
      now
    );
    expect(await stamp()).toBe(first);
    expect(await stamp()).toBe(first);

    await storeWarmedRows(
      snapshots24h,
      snapshots24h.params(now),
      [{ timestamp: second, demand_mw: 31_000 }],
      now
    );
    expect(await stamp()).toBe(first);

    await dropComposedDashboardPayloads();
    expect(await stamp()).toBe(second);

    await dropComposedDashboardPayloads();
    expect(await stamp()).toBe(second);
  });

  it("rebuilds dashboard:day after publish so share cards keep facts", async () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    const stamp = "2026-10-14 10:30:00";
    await storeWarmedRows(
      snapshots24h,
      snapshots24h.params(now),
      [{ timestamp: stamp, demand_mw: 32_000 }],
      now
    );
    const fetchPipeRows = vi.spyOn(tinybird, "fetchPipeRows");

    await publishAfterSuccess(now);
    const peeked = await peekOgCacheSnapshot(now);

    expect(peeked.facts?.referenceTimestamp).toBe(stamp);
    expect(peeked.facts?.empty).toBe(false);
    expect(fetchPipeRows).not.toHaveBeenCalled();
  });

  it("still finishes publish when the day payload cannot be rebuilt", async () => {
    clearTinybirdLastGood();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(publishAfterSuccess(new Date("2026-10-14T12:00:00.000Z"))).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[workflow] dashboard day rebuild failed",
      expect.stringContaining("warmed envelope missing")
    );
  });
});
