import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liveCachePolicy } from "@/lib/tinybird-cache";
import {
  CACHE_EPOCH_KEY,
  bumpCacheEpoch,
  bumpHistoricalCacheEpoch,
  externalCacheKey,
  fallbackLogReason,
  getRedis,
  getRedisFailureReason,
  isFreshEnvelope,
  isStaleUsableEnvelope,
  parseRedisGet,
  readThroughCache,
  readThroughCacheResult,
  redisEnvPresent,
  redisKeyFor,
  resetRedisClient,
  resolveRedisRestConfig,
  setRedisForTests,
  UPSTASH_REDIS_CLIENT_OPTIONS,
  type CacheEnvelope,
  type RedisCommands,
} from "@/lib/redis-cache";

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
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        count += 1;
      }
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get<number | string>(key)) ?? 0) + 1;
    await this.set(key, current, { ex: 86_400 });
    return current;
  }
}

describe("readThroughCache", () => {
  afterEach(() => {
    resetRedisClient();
  });

  it("always has a fallback log reason when Redis env is absent", async () => {
    resetRedisClient();
    expect(fallbackLogReason()).toMatch(/env-missing|unknown/);
    expect(fallbackLogReason()).not.toMatch(/eyJ|Bearer |rediss?:\/\//);
  });

  it("falls back to the loader when Redis env is absent", async () => {
    const load = vi.fn(async () => ["live"]);
    await expect(readThroughCache("tb:test", liveCachePolicy(), load)).resolves.toEqual(["live"]);
    await expect(readThroughCacheResult("tb:test", liveCachePolicy(), load)).resolves.toMatchObject({
      data: ["live"],
      status: "fallback",
      reason: expect.stringMatching(/env-missing|unknown/),
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("returns a fresh hit without calling the loader", async () => {
    const redis = new MemoryRedis();
    setRedisForTests(redis);
    const policy = liveCachePolicy();
    const key = await redisKeyFor("tb:snapshots", policy.tier);
    const envelope: CacheEnvelope<string[]> = {
      data: ["cached"],
      cachedAt: Date.now(),
      freshFor: policy.revalidateSeconds,
    };
    await redis.set(key, envelope, { ex: 3_900 });

    const load = vi.fn(async () => ["fresh"]);
    await expect(readThroughCacheResult("tb:snapshots", policy, load)).resolves.toEqual({
      data: ["cached"],
      status: "redis-hit",
    });
    expect(load).not.toHaveBeenCalled();
  });

  it("serves stale data immediately and refreshes in the background", async () => {
    const redis = new MemoryRedis();
    setRedisForTests(redis);
    const policy = liveCachePolicy();
    const key = await redisKeyFor("tb:stale", policy.tier);
    const envelope: CacheEnvelope<string[]> = {
      data: ["stale"],
      cachedAt: Date.now() - (policy.revalidateSeconds + 10) * 1000,
      freshFor: policy.revalidateSeconds,
    };
    await redis.set(key, envelope, { ex: 3_900 });

    const load = vi.fn(async () => ["refreshed"]);
    await expect(readThroughCacheResult("tb:stale", policy, load)).resolves.toEqual({
      data: ["stale"],
      status: "redis-stale",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(load).toHaveBeenCalledOnce();
    const stored = await redis.get<CacheEnvelope<string[]>>(key);
    expect(stored?.data).toEqual(["refreshed"]);
  });

  it("single-flights concurrent misses for the same Redis key", async () => {
    const redis = new MemoryRedis();
    setRedisForTests(redis);
    let release: (value: string[]) => void = () => undefined;
    const gate = new Promise<string[]>((resolve) => {
      release = resolve;
    });
    const load = vi.fn(() => gate);
    const first = readThroughCache("tb:miss", liveCachePolicy(), load);
    const second = readThroughCache("tb:miss", liveCachePolicy(), load);
    await vi.waitFor(() => expect(load).toHaveBeenCalled());
    release(["shared"]);
    await expect(Promise.all([first, second])).resolves.toEqual([["shared"], ["shared"]]);
    expect(load).toHaveBeenCalledOnce();
    await expect(readThroughCacheResult("tb:miss", liveCachePolicy(), async () => ["again"])).resolves.toMatchObject({
      status: "redis-hit",
    });
  });

  it("falls back to the loader when Redis get throws", async () => {
    setRedisForTests({
      get: async () => {
        throw new Error("WRONGPASS invalid token https://secret.upstash.io/path");
      },
      set: async () => "OK",
      del: async () => 0,
      incr: async () => 1,
    });
    const load = vi.fn(async () => ["fallback"]);
    await expect(readThroughCacheResult("tb:err", liveCachePolicy(), load)).resolves.toEqual({
      data: ["fallback"],
      status: "fallback",
      reason: expect.stringContaining("WRONGPASS"),
    });
    const result = await readThroughCacheResult("tb:err", liveCachePolicy(), load);
    expect(result.reason).toContain("redis-get-failed");
    expect(result.reason).toContain("[url]");
    expect(result.reason).not.toContain("secret.upstash.io");
  });

  it("skips Redis for the rest of the isolate after a get failure", async () => {
    const get = vi.fn(async () => {
      throw new TypeError("n.map is not a function");
    });
    setRedisForTests({
      get,
      set: async () => "OK",
      del: async () => 0,
      incr: async () => 1,
    });

    await readThroughCacheResult("tb:outer", liveCachePolicy(), async () => {
      const nested = await readThroughCacheResult("tb:nested", liveCachePolicy(), async () => ["nested"]);
      expect(nested.status).toBe("fallback");
      expect(nested.reason).toContain("n.map");
      return ["outer"];
    });
    expect(get).toHaveBeenCalledOnce();
  });

  it("returns the fallback reason on the cache read, not a module-global", async () => {
    const outer = vi.fn(async () => {
      setRedisForTests(new MemoryRedis());
      await readThroughCacheResult("tb:inner", liveCachePolicy(), async () => ["inner"]);
      return ["outer"];
    });
    setRedisForTests({
      get: async () => {
        throw new TypeError("n.map is not a function");
      },
      set: async () => "OK",
      del: async () => 0,
      incr: async () => 1,
    });

    const result = await readThroughCacheResult("tb:outer", liveCachePolicy(), outer);
    expect(result).toMatchObject({
      data: ["outer"],
      status: "fallback",
      reason: expect.stringContaining("n.map is not a function"),
    });
    expect(getRedisFailureReason()).toBeNull();
  });

  it("parses a JSON-string GET and does not treat objects as pipeline arrays", async () => {
    const envelope: CacheEnvelope<string[]> = {
      data: ["cached"],
      cachedAt: Date.now(),
      freshFor: liveCachePolicy().revalidateSeconds,
    };
    expect(parseRedisGet(JSON.stringify(envelope))).toEqual(envelope);
    expect(parseRedisGet(envelope)).toEqual(envelope);
    expect(parseRedisGet(null)).toBeNull();
    expect(parseRedisGet("1")).toBe(1);
    expect(UPSTASH_REDIS_CLIENT_OPTIONS.enableAutoPipelining).toBe(false);
    expect(UPSTASH_REDIS_CLIENT_OPTIONS.automaticDeserialization).toBe(false);

    setRedisForTests({
      get: async () => parseRedisGet(JSON.stringify(envelope)),
      set: async () => "OK",
      del: async () => 0,
      incr: async () => 1,
    });
    await expect(
      readThroughCacheResult("tb:json-string", liveCachePolicy(), async () => ["fresh"])
    ).resolves.toEqual({
      data: ["cached"],
      status: "redis-hit",
    });
  });

  it("accepts Marketplace KV_REST_API_* aliases and rejects redis-protocol URLs", () => {
    const original = {
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      KV_REST_API_URL: process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    };

    const restore = () => {
      for (const [key, value] of Object.entries(original)) {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      resetRedisClient();
    };

    try {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      process.env.KV_REST_API_URL = "https://example.upstash.io";
      process.env.KV_REST_API_TOKEN = "kv-token";
      resetRedisClient();

      expect(redisEnvPresent()).toBe(true);
      expect(resolveRedisRestConfig()).toMatchObject({
        urlEnv: "KV_REST_API_URL",
        tokenEnv: "KV_REST_API_TOKEN",
        host: "example.upstash.io",
      });

      process.env.UPSTASH_REDIS_REST_URL = "https://mixed.upstash.io";
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      resetRedisClient();
      expect(resolveRedisRestConfig()).toMatchObject({
        urlEnv: "KV_REST_API_URL",
        tokenEnv: "KV_REST_API_TOKEN",
        host: "example.upstash.io",
      });

      process.env.KV_REST_API_URL = "rediss://default:token@example.upstash.io:6379";
      resetRedisClient();
      expect(resolveRedisRestConfig()).toBeNull();
      expect(getRedis()).toBeNull();
      expect(getRedisFailureReason()).toContain("url-not-https");
      expect(getRedisFailureReason()).toContain("rediss");
    } finally {
      restore();
    }
  });

  it("bumps the live epoch so later keys miss", async () => {
    const redis = new MemoryRedis();
    setRedisForTests(redis);
    expect(await redisKeyFor("tb:live", "live")).toBe("grid:0:tb:live");
    await bumpCacheEpoch();
    expect(await redis.get<number>(CACHE_EPOCH_KEY)).toBe(1);
    expect(await redisKeyFor("tb:live", "live")).toBe("grid:1:tb:live");
    expect(await redisKeyFor("tb:old-day", "historical")).toBe("grid:hist:0:tb:old-day");
    await bumpHistoricalCacheEpoch();
    expect(await redisKeyFor("tb:old-day", "historical")).toBe("grid:hist:1:tb:old-day");
  });
});

describe("redis-cache module boundaries", () => {
  it("does not import next/server so static pages stay prerendered", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./redis-cache.ts"), "utf8");
    expect(source).not.toMatch(/from ["']next\/server["']/);
  });
});

describe("cache key helpers", () => {
  it("builds stable external keys", () => {
    expect(externalCacheKey("elexon", ["fuelinst", "a", "b"])).toBe("ext:elexon:fuelinst:a:b");
  });

  it("classifies fresh vs stale envelopes", () => {
    const policy = liveCachePolicy();
    const now = Date.parse("2026-10-10T12:00:00.000Z");
    const fresh: CacheEnvelope<number> = {
      data: 1,
      cachedAt: now - 1_000,
      freshFor: policy.revalidateSeconds,
    };
    const stale: CacheEnvelope<number> = {
      data: 1,
      cachedAt: now - (policy.revalidateSeconds + 10) * 1000,
      freshFor: policy.revalidateSeconds,
    };
    expect(isFreshEnvelope(fresh, policy, now)).toBe(true);
    expect(isFreshEnvelope(stale, policy, now)).toBe(false);
    expect(isStaleUsableEnvelope(stale, policy, now)).toBe(true);
  });
});
