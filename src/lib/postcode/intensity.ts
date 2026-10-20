import type { DataState } from "@/lib/data-state";
import {
  CI_REGION_FRESH_MS,
  CI_REGION_RETAIN_SECONDS,
  ciRegionCacheKey,
  regionalIntensityUrl,
  type CiRegionId,
} from "@/lib/postcode/areas";
import { fetchBounded, type BoundedFetch } from "@/lib/postcode/http";
import { getRedis, type RedisCommands } from "@/lib/redis-cache";

export type IntensityReading = {
  regionId: CiRegionId;
  from: string | null;
  to: string | null;
  forecast: number | null;
  index: string | null;
  fetchedAt: string;
};

export type IntensityResult = {
  state: DataState | null;
  reading: IntensityReading | null;
};

type CacheEntry = {
  freshUntil: number;
  stale: boolean;
  reading: IntensityReading | null;
};

const memory = new Map<CiRegionId, CacheEntry>();
const inflight = new Map<CiRegionId, Promise<IntensityResult>>();

export function resetRegionalIntensityForTests(): void {
  memory.clear();
  inflight.clear();
}

export type IntensityDeps = BoundedFetch & {
  now?: () => number;
  redis?: RedisCommands | null;
};

function resultOf(entry: CacheEntry): IntensityResult {
  if (!entry.reading) {
    return { state: "not_yet_available", reading: null };
  }
  return { state: entry.stale ? "stale" : null, reading: entry.reading };
}

function parseEntry(value: unknown): CacheEntry | null {
  const parsed = typeof value === "string" ? safeJson(value) : value;
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const record = parsed as Partial<CacheEntry>;
  if (typeof record.freshUntil !== "number" || typeof record.stale !== "boolean") {
    return null;
  }
  const reading = record.reading;
  if (reading != null && (typeof reading !== "object" || typeof reading.regionId !== "number")) {
    return null;
  }
  return {
    freshUntil: record.freshUntil,
    stale: record.stale,
    reading: reading ?? null,
  };
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function readRedis(redis: RedisCommands | null, id: CiRegionId): Promise<CacheEntry | null> {
  if (!redis) {
    return null;
  }
  try {
    return parseEntry(await redis.get(ciRegionCacheKey(id)));
  } catch {
    return null;
  }
}

async function writeRedis(redis: RedisCommands | null, id: CiRegionId, entry: CacheEntry): Promise<void> {
  if (!redis) {
    return;
  }
  try {
    await redis.set(ciRegionCacheKey(id), JSON.stringify(entry), { ex: CI_REGION_RETAIN_SECONDS });
  } catch {
    // The process copy is enough for this isolate. The key is only the region id.
  }
}

function sampleOf(value: unknown): { from: string | null; to: string | null; forecast: number | null; index: string | null } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { from?: unknown; to?: unknown; intensity?: unknown };
  const intensity = record.intensity;
  const forecast =
    intensity && typeof intensity === "object" && typeof (intensity as { forecast?: unknown }).forecast === "number"
      ? (intensity as { forecast: number }).forecast
      : null;
  const index =
    intensity && typeof intensity === "object" && typeof (intensity as { index?: unknown }).index === "string"
      ? (intensity as { index: string }).index
      : null;
  return {
    from: typeof record.from === "string" ? record.from : null,
    to: typeof record.to === "string" ? record.to : null,
    forecast,
    index,
  };
}

export function parseRegionalIntensity(body: unknown, regionId: CiRegionId, fetchedAt: string): IntensityReading | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const data = (body as { data?: unknown }).data;
  const first = Array.isArray(data) ? data[0] : null;
  if (!first || typeof first !== "object") {
    return null;
  }
  const record = first as { regionid?: unknown; data?: unknown };
  if (record.regionid !== regionId) {
    return null;
  }
  const samples = Array.isArray(record.data) ? record.data : [];
  const sample = sampleOf(samples[0]);
  if (!sample) {
    return null;
  }
  return { regionId, fetchedAt, ...sample };
}

async function load(regionId: CiRegionId, deps: IntensityDeps): Promise<IntensityResult> {
  const now = deps.now ?? Date.now;
  const redis = deps.redis === undefined ? getRedis() : deps.redis;
  const cached = (await readRedis(redis, regionId)) ?? memory.get(regionId) ?? null;
  if (cached && now() < cached.freshUntil) {
    memory.set(regionId, cached);
    return resultOf(cached);
  }

  const url = regionalIntensityUrl(regionId);
  try {
    const response = await fetchBounded(url, deps);
    const body: unknown = await response.json();
    const reading = parseRegionalIntensity(body, regionId, new Date(now()).toISOString());
    if (!reading) {
      throw new Error("carbon intensity region response did not match");
    }
    const entry: CacheEntry = { freshUntil: now() + CI_REGION_FRESH_MS, stale: false, reading };
    memory.set(regionId, entry);
    await writeRedis(redis, regionId, entry);
    return resultOf(entry);
  } catch {
    const entry: CacheEntry = {
      freshUntil: now() + CI_REGION_FRESH_MS,
      stale: cached?.reading != null,
      reading: cached?.reading ?? null,
    };
    memory.set(regionId, entry);
    await writeRedis(redis, regionId, entry);
    return resultOf(entry);
  }
}

export function readRegionalIntensity(regionId: CiRegionId, deps: IntensityDeps = {}): Promise<IntensityResult> {
  const pending = inflight.get(regionId);
  if (pending) {
    return pending;
  }
  const promise = load(regionId, deps).finally(() => {
    inflight.delete(regionId);
  });
  inflight.set(regionId, promise);
  return promise;
}
