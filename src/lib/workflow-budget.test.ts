import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FatalError, RetryableError } from "workflow";
import { EIRGRID_TINYBIRD_OPS } from "@/lib/eirgrid/budget";
import { resetRedisClient, setRedisForTests, type RedisCommands } from "@/lib/redis-cache";
import { TINYBIRD_OPS_LIMIT, reserveTinybirdOp, tinybirdOpsKey } from "@/lib/tinybird-ops";
import { TinybirdHttpError } from "@/lib/tinybird";
import * as tinybird from "@/lib/tinybird";
import { LIVE_PIPES, LONG_PIPES, runWarmSeries, tinybirdRetryAfter, toTinybirdStepError, warmPipeById } from "@/lib/warm-pipes";
import {
  constraintsSlot,
  eirgridSlot,
  gasSlot,
  tecSlot,
  halfHourSlot,
  pricesSlot,
  yesterdaySlot,
  takeWorkflowSlot,
} from "@/lib/workflow-slot";
import { publishStep } from "@/workflows/steps/publish";
import { takeSlotStep } from "@/workflows/steps/slot";
import { warmPipeStep } from "@/workflows/steps/warm";

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

function retries(fn: unknown): number | undefined {
  return (fn as { maxRetries?: number }).maxRetries;
}

describe("workflow budget", () => {
  afterEach(() => {
    resetRedisClient();
    vi.restoreAllMocks();
  });

  it("counts a success day as 378 Tinybird ops and stops at 450", () => {
    const queries = LIVE_PIPES.length * 48 + LONG_PIPES.length * 4;
    const events = 2 * 24 + 4 + 2;
    expect(LIVE_PIPES).toHaveLength(6);
    expect(LONG_PIPES).toHaveLength(9);
    expect(queries + events).toBe(378);
    expect(TINYBIRD_OPS_LIMIT).toBe(450);
    expect(EIRGRID_TINYBIRD_OPS).toBe(0);
    const northernIreland = readFileSync(resolve(process.cwd(), "src/workflows/eirgrid-ni.ts"), "utf8");
    expect(northernIreland).not.toContain("warmPipeStep");
    expect(northernIreland).not.toContain("queryPipe");
  });

  it("keeps the existing workflow slots and floors an early Northern Ireland run to the previous slot", () => {
    const now = new Date("2026-10-15T06:07:00.000Z");
    expect(halfHourSlot(now)).toBe("2026-10-15T06:00:00.000Z");
    expect(halfHourSlot(new Date("2026-10-15T06:37:00.000Z"))).toBe("2026-10-15T06:30:00.000Z");
    expect(pricesSlot(now)).toBe("2026-10-15T06:30:00.000Z");
    expect(pricesSlot(new Date("2026-10-15T05:00:00.000Z"))).toBe("2026-10-15T00:30:00.000Z");
    expect(yesterdaySlot(now)).toBe("2026-10-15");
    expect(constraintsSlot(now, "breakdown")).toBe("2026-10-15T04:40:00.000Z");
    expect(constraintsSlot(now, "day-ahead")).toBe("2026-10-15T16:40:00.000Z");
    expect(gasSlot(now)).toBe("2026-10-15T06:05:00.000Z");
    expect(gasSlot(new Date("2026-10-15T06:01:00.000Z"))).toBe("2026-10-15T06:05:00.000Z");
    expect(tecSlot(now)).toBe("2026-10-15T06:15:00.000Z");
    expect(tecSlot(new Date("2026-10-15T00:05:00.000Z"))).toBe("2026-10-15T06:15:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T06:15:00.000Z"))).toBe("2026-10-15T06:15:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T06:20:00.000Z"))).toBe("2026-10-15T06:15:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T06:10:00.000Z"))).toBe("2026-10-15T05:15:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T00:05:00.000Z"))).toBe("2026-10-14T23:15:00.000Z");
  });

  it("sets Tinybird steps to one retry", () => {
    expect(retries(warmPipeStep)).toBe(1);
    expect(retries(takeSlotStep)).toBe(1);
    expect(retries(publishStep)).toBe(1);
    const electricity = readFileSync(
      resolve(process.cwd(), "src/workflows/electricity.ts"),
      "utf8"
    );
    const prices = readFileSync(resolve(process.cwd(), "src/workflows/prices.ts"), "utf8");
    const yesterday = readFileSync(resolve(process.cwd(), "src/workflows/yesterday.ts"), "utf8");
    expect(electricity.match(/await warmPipeStep\(/g)).toHaveLength(6);
    expect(prices.match(/await warmPipeStep\(/g)).toHaveLength(9);
    expect(electricity).not.toContain("Promise.all");
    expect(prices).not.toContain("Promise.all");
    expect(yesterday).not.toContain("warmPipeStep");
    expect(yesterday).not.toContain("fetchPipeRows");
    const publishAt = prices.indexOf("await publishStep(nowIso, false)");
    const gasAt = prices.indexOf("await publishCompletedGasDayStep(nowIso)");
    const fatalAt = prices.indexOf("required price source failed");
    expect(publishAt).toBeGreaterThan(-1);
    expect(gasAt).toBeGreaterThan(publishAt);
    expect(fatalAt).toBeGreaterThan(gasAt);
    expect(prices).toContain("fetchSapStep");
    expect(prices).toContain("if (!posted.ok)");
  });

  it("backs off 30s then 2m, and treats 400 as fatal", () => {
    expect(tinybirdRetryAfter(1, null)).toBe("30s");
    expect(tinybirdRetryAfter(2, null)).toBe("2m");
    expect(tinybirdRetryAfter(2, "45s")).toBe("45s");

    expect(toTinybirdStepError(new TinybirdHttpError(400, "schema", null))).toBeInstanceOf(
      FatalError
    );
    expect(toTinybirdStepError(new TinybirdHttpError(500, "Code: 47", null))).toBeInstanceOf(
      FatalError
    );

    const retry = toTinybirdStepError(new TinybirdHttpError(429, "limit", "45s"));
    expect(retry).toBeInstanceOf(RetryableError);
    const delta = (retry as RetryableError).retryAfter.getTime() - Date.now();
    expect(delta).toBeGreaterThan(30_000);
    expect(delta).toBeLessThan(60_000);
  });

  it("returns a small status object and does not repeat a finished pipe", async () => {
    const redis = new MemoryRedis();
    setRedisForTests(redis);
    const now = new Date("2026-10-14T12:00:00.000Z");
    const rows = [{ timestamp: "2026-10-14 11:30:00" }];
    let calls = 0;
    const fetchPipeRows = vi.spyOn(tinybird, "fetchPipeRows").mockImplementation(async () => {
      calls += 1;
      if (calls === 2) {
        throw new TinybirdHttpError(500, "down", null);
      }
      return rows;
    });

    const first = await warmPipeById(LIVE_PIPES[0].id, now);
    expect(Object.keys(first).sort()).toEqual(["bytes", "cachedAt", "ok", "rows"]);
    expect(first.ok).toBe(true);
    expect(first.rows).toBe(1);
    expect(Array.isArray(first.rows)).toBe(false);
    expect(JSON.stringify(first).length).toBeLessThan(120);

    const ids = LIVE_PIPES.map((pipe) => pipe.id);
    await expect(runWarmSeries(ids, now, new Set([ids[0]]))).rejects.toBeInstanceOf(RetryableError);
    await runWarmSeries(ids, now, new Set([ids[0]]));

    const seen = fetchPipeRows.mock.calls.map(
      (call) => `${String(call[0])}:${JSON.stringify(call[1])}`
    );
    expect(seen[1]).toBe(seen[2]);
    expect(seen.slice(1).filter((value) => value === seen[0])).toEqual([]);
    expect(seen).toHaveLength(1 + 1 + (ids.length - 1));
  });

  it("lets the owner re-enter a slot and rejects a second start", async () => {
    setRedisForTests(new MemoryRedis());
    const fetchPipeRows = vi.spyOn(tinybird, "fetchPipeRows");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const slot = halfHourSlot(new Date("2026-10-14T12:07:00.000Z"));
    expect(slot).toBe("2026-10-14T12:00:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T06:15:00.000Z"))).toBe("2026-10-15T06:15:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T06:20:00.000Z"))).toBe("2026-10-15T06:15:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T06:10:00.000Z"))).toBe("2026-10-15T05:15:00.000Z");
    expect(eirgridSlot(new Date("2026-10-15T00:05:00.000Z"))).toBe("2026-10-14T23:15:00.000Z");

    await takeWorkflowSlot("electricity", slot, "owner-a");
    await takeWorkflowSlot("electricity", slot, "owner-a");
    await expect(takeWorkflowSlot("electricity", slot, "owner-b")).rejects.toBeInstanceOf(
      FatalError
    );
    expect(warn).toHaveBeenCalledWith("[workflow] slot held: electricity");
    expect(error).not.toHaveBeenCalled();
    expect(fetchPipeRows).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it("is fatal once the daily counter is already 450", async () => {
    const redis = new MemoryRedis();
    setRedisForTests(redis);
    const now = new Date("2026-10-14T03:00:00.000Z");
    for (let i = 0; i < TINYBIRD_OPS_LIMIT; i += 1) {
      await reserveTinybirdOp(now);
    }
    await expect(reserveTinybirdOp(now)).rejects.toBeInstanceOf(FatalError);
    expect(await redis.get(tinybirdOpsKey(now))).toBe(450);
    expect(tinybirdOpsKey(now)).toBe("grid:tb:ops:2026-10-14");
  });
});
