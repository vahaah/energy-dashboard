import { FatalError } from "workflow";
import { getRedis } from "@/lib/redis-cache";

/** Queries + Events POSTs. The success path is 378; this is the hard stop. */
export const TINYBIRD_OPS_LIMIT = 450;
const OPS_TTL_SECONDS = 172_800;

export function tinybirdOpsKey(now: Date): string {
  return `grid:tb:ops:${now.toISOString().slice(0, 10)}`;
}

export async function readTinybirdOps(now = new Date()): Promise<number> {
  const redis = getRedis();
  if (!redis) {
    return 0;
  }
  const current = await redis.get<number | string>(tinybirdOpsKey(now));
  const count = Number(current ?? 0);
  return Number.isFinite(count) ? count : 0;
}

/**
 * Call immediately before a Tinybird HTTP call. At 450 the step is fatal and
 * the previous envelope stays. The increment counts the attempt even if the
 * HTTP call then fails, including the at-least-once retry.
 */
export async function reserveTinybirdOp(now = new Date()): Promise<number> {
  const redis = getRedis();
  if (!redis) {
    throw new FatalError("redis unavailable for tinybird op counter");
  }

  const key = tinybirdOpsKey(now);
  const current = Number((await redis.get<number | string>(key)) ?? 0);
  if (current >= TINYBIRD_OPS_LIMIT) {
    throw new FatalError(`tinybird daily op cap ${current}`);
  }

  const next = await redis.incr(key);
  if (next === 1) {
    await redis.expire(key, OPS_TTL_SECONDS);
  }
  if (next > TINYBIRD_OPS_LIMIT) {
    throw new FatalError(`tinybird daily op cap ${next}`);
  }
  return next;
}
