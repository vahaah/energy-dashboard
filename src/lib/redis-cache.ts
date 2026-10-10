import { Redis } from "@upstash/redis";
import {
  type TinybirdCachePolicy,
  type TinybirdCacheTier,
} from "@/lib/tinybird-cache";

export const CACHE_EPOCH_KEY = "grid:cache-epoch";
export const REDIS_LOCK_SECONDS = 30;

export type CacheEnvelope<T> = {
  data: T;
  cachedAt: number;
  freshFor: number;
};

export type RedisCommands = {
  get: <T>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean }
  ) => Promise<"OK" | null>;
  del: (...keys: string[]) => Promise<number>;
  incr: (key: string) => Promise<number>;
};

let testRedis: RedisCommands | null = null;
let cachedRedis: RedisCommands | null = null;

export function redisEnvPresent(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): RedisCommands | null {
  if (testRedis) {
    return testRedis;
  }

  if (!redisEnvPresent()) {
    return null;
  }

  if (cachedRedis != null) {
    return cachedRedis;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  cachedRedis = {
    get: <T>(key: string) => redis.get<T>(key),
    set: async (key, value, opts) => {
      const result = opts?.nx
        ? await redis.set(key, value, { nx: true, ex: opts.ex ?? REDIS_LOCK_SECONDS })
        : await redis.set(key, value, opts?.ex != null ? { ex: opts.ex } : undefined);
      return result === "OK" ? "OK" : null;
    },
    del: (...keys) => redis.del(...keys),
    incr: (key) => redis.incr(key),
  };
  return cachedRedis;
}

export function setRedisForTests(client: RedisCommands | null): void {
  testRedis = client;
  cachedRedis = null;
}

export function resetRedisClient(): void {
  testRedis = null;
  cachedRedis = null;
}

export function externalCacheKey(source: string, parts: readonly string[]): string {
  return ["ext", source, ...parts].join(":");
}

export function redisTtlSeconds(policy: TinybirdCachePolicy): number {
  return policy.revalidateSeconds + policy.staleWhileRevalidate;
}

export function envelopeAgeMs(envelope: CacheEnvelope<unknown>, now = Date.now()): number {
  return now - envelope.cachedAt;
}

export function isFreshEnvelope(
  envelope: CacheEnvelope<unknown>,
  policy: TinybirdCachePolicy,
  now = Date.now()
): boolean {
  return envelopeAgeMs(envelope, now) < policy.revalidateSeconds * 1000;
}

export function isStaleUsableEnvelope(
  envelope: CacheEnvelope<unknown>,
  policy: TinybirdCachePolicy,
  now = Date.now()
): boolean {
  return envelopeAgeMs(envelope, now) < redisTtlSeconds(policy) * 1000;
}

export async function currentCacheEpoch(): Promise<string> {
  const redis = getRedis();
  if (!redis) {
    return "0";
  }

  const value = await redis.get<number | string>(CACHE_EPOCH_KEY);
  return String(value ?? "0");
}

export async function bumpCacheEpoch(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  await redis.incr(CACHE_EPOCH_KEY);
}

export async function redisKeyFor(logicalKey: string, tier: TinybirdCacheTier): Promise<string> {
  if (tier === "historical") {
    return `grid:hist:${logicalKey}`;
  }

  const epoch = await currentCacheEpoch();
  return `grid:${epoch}:${logicalKey}`;
}

export function scheduleBackground(work: () => Promise<void>): void {
  // Keep this module free of Next request APIs so ISR pages stay static.
  void work();
}

export async function readThroughCache<T>(
  logicalKey: string,
  policy: TinybirdCachePolicy,
  load: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (!redis) {
    return load();
  }

  let key: string;
  try {
    key = await redisKeyFor(logicalKey, policy.tier);
    const hit = await redis.get<CacheEnvelope<T>>(key);
    if (hit && isFreshEnvelope(hit, policy)) {
      return hit.data;
    }
    if (hit && isStaleUsableEnvelope(hit, policy)) {
      scheduleRefresh(key, policy, load);
      return hit.data;
    }
  } catch {
    return load();
  }

  return refreshAndStore(redis, key, policy, load);
}

async function refreshAndStore<T>(
  redis: RedisCommands,
  key: string,
  policy: TinybirdCachePolicy,
  load: () => Promise<T>
): Promise<T> {
  const data = await load();
  const envelope: CacheEnvelope<T> = {
    data,
    cachedAt: Date.now(),
    freshFor: policy.revalidateSeconds,
  };
  try {
    await redis.set(key, envelope, { ex: redisTtlSeconds(policy) });
  } catch {
    return data;
  }
  return data;
}

function scheduleRefresh<T>(
  key: string,
  policy: TinybirdCachePolicy,
  load: () => Promise<T>
): void {
  scheduleBackground(async () => {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    const lockKey = `${key}:lock`;
    const locked = await redis.set(lockKey, "1", { nx: true, ex: REDIS_LOCK_SECONDS });
    if (locked !== "OK") {
      return;
    }

    try {
      await refreshAndStore(redis, key, policy, load);
    } finally {
      await redis.del(lockKey);
    }
  });
}
