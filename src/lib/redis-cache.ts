import { Redis } from "@upstash/redis";
import { waitUntil } from "@vercel/functions";
import {
  type TinybirdCachePolicy,
  type TinybirdCacheTier,
} from "@/lib/tinybird-cache";

export const CACHE_EPOCH_KEY = "grid:cache-epoch";
export const CACHE_HIST_EPOCH_KEY = "grid:cache-hist-epoch";
export const REDIS_LOCK_SECONDS = 30;
export const GRID_CACHE_HEADER = "x-grid-cache";
export const GRID_CACHE_STATUSES = ["redis-hit", "redis-stale", "miss", "fallback"] as const;

export type GridCacheStatus = (typeof GRID_CACHE_STATUSES)[number];

export type CacheRead<T> = {
  data: T;
  status: GridCacheStatus;
  reason?: string;
};

export const UPSTASH_REDIS_CLIENT_OPTIONS = {
  automaticDeserialization: false,
  enableAutoPipelining: false,
} as const;

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
  expire: (key: string, seconds: number) => Promise<number>;
};

const REDIS_REST_PAIRS = [
  { urlEnv: "UPSTASH_REDIS_REST_URL", tokenEnv: "UPSTASH_REDIS_REST_TOKEN" },
  { urlEnv: "KV_REST_API_URL", tokenEnv: "KV_REST_API_TOKEN" },
] as const;
const REDIS_REST_URL_KEYS = REDIS_REST_PAIRS.map((pair) => pair.urlEnv);
const REDIS_REST_TOKEN_KEYS = REDIS_REST_PAIRS.map((pair) => pair.tokenEnv);
const REDIS_PROTOCOL_URL_KEYS = ["KV_URL", "REDIS_URL"] as const;

export type RedisRestConfig = {
  url: string;
  token: string;
  urlEnv: string;
  tokenEnv: string;
  host: string;
};

let testRedis: RedisCommands | null = null;
let cachedRedis: RedisCommands | null = null;
let lastRedisFailure: string | null = null;
let redisUnusableUntil = 0;
const REDIS_COOLDOWN_MS = 15_000;

export function getRedisFailureReason(): string | null {
  return lastRedisFailure;
}

export function fallbackLogReason(): string {
  return lastRedisFailure ?? `unknown present=${formatKeyList(redisEnvKeyPresence().present)}`;
}

export function redisEnvPresent(): boolean {
  return resolveRedisRestConfig() != null;
}

export function redisEnvKeyPresence(): { present: string[]; absent: string[] } {
  const present: string[] = [];
  const absent: string[] = [];
  for (const key of [...REDIS_REST_URL_KEYS, ...REDIS_REST_TOKEN_KEYS, ...REDIS_PROTOCOL_URL_KEYS]) {
    if (readEnv(key)) {
      present.push(key);
    } else {
      absent.push(key);
    }
  }
  return { present, absent };
}

export function resolveRedisRestConfig(): RedisRestConfig | null {
  let partial: string | null = null;
  for (const pair of REDIS_REST_PAIRS) {
    const url = readEnv(pair.urlEnv);
    const token = readEnv(pair.tokenEnv);
    if (url && token) {
      const parsed = parseRestUrl(url);
      if (!parsed.ok) {
        setRedisFailure(`url-not-https protocol=${parsed.protocol} env=${pair.urlEnv}`);
        return null;
      }
      lastRedisFailure = null;
      return {
        url,
        token,
        urlEnv: pair.urlEnv,
        tokenEnv: pair.tokenEnv,
        host: parsed.host,
      };
    }
    if (url || token) {
      partial ??= url
        ? `token-missing urlEnv=${pair.urlEnv}`
        : `url-missing tokenEnv=${pair.tokenEnv}`;
    }
  }

  const protocolUrls = firstEnv(REDIS_PROTOCOL_URL_KEYS);
  setRedisFailure(
    partial ??
      (protocolUrls
        ? `env-missing have-redis-protocol=${protocolUrls.key}`
        : `env-missing present=${formatKeyList(redisEnvKeyPresence().present)}`)
  );
  return null;
}

export function getRedis(): RedisCommands | null {
  if (Date.now() < redisUnusableUntil) {
    return null;
  }

  if (testRedis) {
    return testRedis;
  }

  const config = resolveRedisRestConfig();
  if (!config) {
    return null;
  }

  if (cachedRedis != null) {
    return cachedRedis;
  }

  try {
    // Default auto-pipelining runs GET through pipeline.exec, which does
    // res.map() and throws TypeError when Upstash returns a single object.
    const redis = new Redis({
      url: config.url,
      token: config.token,
      ...UPSTASH_REDIS_CLIENT_OPTIONS,
    });
    cachedRedis = {
      get: async <T>(key: string) => parseRedisGet<T>(await redis.get<unknown>(key)),
      set: async (key, value, opts) => {
        const result = opts?.nx
          ? await redis.set(key, value, { nx: true, ex: opts.ex ?? REDIS_LOCK_SECONDS })
          : await redis.set(key, value, opts?.ex != null ? { ex: opts.ex } : undefined);
        return result === "OK" ? "OK" : null;
      },
      del: (...keys) => redis.del(...keys),
      incr: (key) => redis.incr(key),
      expire: (key, seconds) => redis.expire(key, seconds),
    };
    return cachedRedis;
  } catch (error) {
    setRedisFailure(formatRedisError("constructor", error, config.host));
    return null;
  }
}

export function setRedisForTests(client: RedisCommands | null): void {
  testRedis = client;
  cachedRedis = null;
  lastRedisFailure = null;
  redisUnusableUntil = 0;
}

export function resetRedisClient(): void {
  testRedis = null;
  cachedRedis = null;
  lastRedisFailure = null;
  redisUnusableUntil = 0;
  inflightLoads.clear();
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

export async function currentHistoricalCacheEpoch(): Promise<string> {
  const redis = getRedis();
  if (!redis) {
    return "0";
  }

  const value = await redis.get<number | string>(CACHE_HIST_EPOCH_KEY);
  return String(value ?? "0");
}

export async function bumpHistoricalCacheEpoch(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  await redis.incr(CACHE_HIST_EPOCH_KEY);
}

export async function redisKeyFor(logicalKey: string, tier: TinybirdCacheTier): Promise<string> {
  if (tier === "historical") {
    const epoch = await currentHistoricalCacheEpoch();
    return `grid:hist:${epoch}:${logicalKey}`;
  }

  const epoch = await currentCacheEpoch();
  return `grid:${epoch}:${logicalKey}`;
}

export function scheduleBackground(work: () => Promise<void>): void {
  const pending = work();
  try {
    waitUntil(pending);
  } catch {
    void pending;
  }
}

const inflightLoads = new Map<string, Promise<unknown>>();

export async function peekThroughCache<T>(
  logicalKey: string,
  policy: TinybirdCachePolicy
): Promise<T | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  try {
    const key = await redisKeyFor(logicalKey, policy.tier);
    const hit = await redis.get<CacheEnvelope<T>>(key);
    if (hit && isStaleUsableEnvelope(hit, policy)) {
      return hit.data;
    }
    return null;
  } catch (error) {
    markRedisUnusable("get", error);
    return null;
  }
}

export async function readThroughCache<T>(
  logicalKey: string,
  policy: TinybirdCachePolicy,
  load: () => Promise<T>
): Promise<T> {
  return (await readThroughCacheResult(logicalKey, policy, load)).data;
}

export async function readThroughCacheResult<T>(
  logicalKey: string,
  policy: TinybirdCachePolicy,
  load: () => Promise<T>
): Promise<CacheRead<T>> {
  const redis = getRedis();
  if (!redis) {
    return {
      data: await load(),
      status: "fallback",
      reason: lastRedisFailure ?? `env-missing present=${formatKeyList(redisEnvKeyPresence().present)}`,
    };
  }

  let key: string;
  try {
    key = await redisKeyFor(logicalKey, policy.tier);
    const hit = await redis.get<CacheEnvelope<T>>(key);
    if (hit && isFreshEnvelope(hit, policy)) {
      return { data: hit.data, status: "redis-hit" };
    }
    if (hit && isStaleUsableEnvelope(hit, policy)) {
      scheduleRefresh(key, policy, load);
      return { data: hit.data, status: "redis-stale" };
    }
  } catch (error) {
    const reason = markRedisUnusable("get", error);
    return {
      data: await load(),
      status: "fallback",
      reason,
    };
  }

  return { data: await refreshAndStore(redis, key, policy, load), status: "miss" };
}

export function parseRedisGet<T>(value: unknown): T | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

async function refreshAndStore<T>(
  redis: RedisCommands,
  key: string,
  policy: TinybirdCachePolicy,
  load: () => Promise<T>
): Promise<T> {
  const existing = inflightLoads.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const pending = (async () => {
    try {
      const data = await load();
      const envelope: CacheEnvelope<T> = {
        data,
        cachedAt: Date.now(),
        freshFor: policy.revalidateSeconds,
      };
      try {
        await redis.set(key, envelope, { ex: redisTtlSeconds(policy) });
      } catch (error) {
        markRedisUnusable("set", error);
        return data;
      }
      return data;
    } finally {
      inflightLoads.delete(key);
    }
  })();

  inflightLoads.set(key, pending);
  return pending;
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

function readEnv(key: string): string | null {
  const value = process.env[key]?.trim();
  return value ? value : null;
}

function firstEnv(keys: readonly string[]): { key: string; value: string } | null {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) {
      return { key, value };
    }
  }
  return null;
}

function parseRestUrl(url: string): { ok: true; host: string } | { ok: false; protocol: string } {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(":", "") || "invalid";
    if (parsed.protocol !== "https:") {
      return { ok: false, protocol };
    }
    return { ok: true, host: parsed.hostname };
  } catch {
    return { ok: false, protocol: "invalid" };
  }
}

function formatKeyList(keys: string[]): string {
  return keys.length > 0 ? keys.join(",") : "none";
}

function setRedisFailure(reason: string): void {
  lastRedisFailure = reason;
}

function markRedisUnusable(op: string, error: unknown): string {
  const reason = formatRedisError(op, error, redisHostHint());
  setRedisFailure(reason);
  cachedRedis = null;
  redisUnusableUntil = Date.now() + REDIS_COOLDOWN_MS;
  return reason;
}

function redisHostHint(): string {
  const url = firstEnv(REDIS_REST_URL_KEYS);
  if (!url) {
    return "none";
  }
  const parsed = parseRestUrl(url.value);
  return parsed.ok ? parsed.host : parsed.protocol;
}

function formatRedisError(op: string, error: unknown, host: string): string {
  const name = error instanceof Error ? error.name : "Error";
  const raw = error instanceof Error ? error.message : "redis failed";
  const message = raw
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/rediss?:\/\/[^\s]+/gi, "[url]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 160);
  return `redis-${op}-failed host=${host} name=${name} message=${message}`;
}
