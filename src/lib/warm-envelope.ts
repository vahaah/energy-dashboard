import { jsonBytes, stepStatus, type StepStatus } from "@/lib/step-status";
import { pipeCacheIdentity, type QueryPipeOptions } from "@/lib/tinybird";
import { getRedis, peekEnvelopeThroughCache, redisKeyFor } from "@/lib/redis-cache";
import type { CacheEnvelope } from "@/lib/redis-cache";
import type { WarmPipe } from "@/lib/warm-pipes";

/** Cadence from ARCH §8. Ten minutes of grace so a late cron does not blank the key. */
export const LIVE_ENVELOPE_TTL_SECONDS = 1_800;
export const LONG_ENVELOPE_TTL_SECONDS = 21_600;
const ENVELOPE_GRACE_SECONDS = 600;

export function envelopeTtlSeconds(cadence: WarmPipe["cadence"]): number {
  const base = cadence === "6h" ? LONG_ENVELOPE_TTL_SECONDS : LIVE_ENVELOPE_TTL_SECONDS;
  return base + ENVELOPE_GRACE_SECONDS;
}

export async function storeWarmedRows<T>(
  spec: Pick<WarmPipe, "pipe" | "range" | "cadence">,
  params: Record<string, string>,
  rows: T[],
  now: Date
): Promise<StepStatus> {
  const redis = getRedis();
  if (!redis) {
    return stepStatus(true, rows.length, jsonBytes(rows));
  }

  const options: QueryPipeOptions = { range: spec.range, now };
  const { logicalKey, policy } = pipeCacheIdentity(spec.pipe, params, options);
  const key = await redisKeyFor(logicalKey, policy.tier);
  const cachedAt = Date.now();
  const envelope = {
    data: rows,
    cachedAt,
    freshFor: policy.revalidateSeconds,
  };
  await redis.set(key, envelope, { ex: envelopeTtlSeconds(spec.cadence) });
  return stepStatus(true, rows.length, jsonBytes(rows), cachedAt);
}

export async function peekWarmedPipe<T>(
  pipeName: string,
  params: Record<string, string> | undefined,
  options?: QueryPipeOptions
): Promise<T[] | null> {
  const envelope = await peekWarmedEnvelope<T>(pipeName, params, options);
  return envelope ? envelope.data : null;
}

/** Warmed rows plus `cachedAt` (when Grid stored them). Never calls Tinybird. */
export async function peekWarmedEnvelope<T>(
  pipeName: string,
  params: Record<string, string> | undefined,
  options?: QueryPipeOptions
): Promise<CacheEnvelope<T[]> | null> {
  const { logicalKey, policy } = pipeCacheIdentity(pipeName, params, options);
  return peekEnvelopeThroughCache<T[]>(logicalKey, policy);
}
