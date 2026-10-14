import { FatalError } from "workflow";
import { getRedis } from "@/lib/redis-cache";

export const SLOT_TTL_SECONDS = {
  electricity: 35 * 60,
  prices: 6 * 60 * 60,
  yesterday: 24 * 60 * 60,
} as const;

export type WorkflowJob = keyof typeof SLOT_TTL_SECONDS;

export function workflowSlotKey(job: WorkflowJob, slot: string): string {
  return `grid:wf-slot:${job}:${slot}`;
}

/** Floor to the UTC half-hour the electricity cron represents. */
export function halfHourSlot(now: Date): string {
  const minute = now.getUTCMinutes() < 30 ? "00" : "30";
  return `${now.toISOString().slice(0, 14)}${minute}:00.000Z`;
}

export function isHourSlot(slot: string): boolean {
  return slot.slice(14, 16) === "00";
}

/** Prices cron slots at 00:30, 06:30, 12:30, and 18:30 UTC. */
export function pricesSlot(now: Date): string {
  const hour = Math.floor(now.getUTCHours() / 6) * 6;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 30, 0, 0)
  ).toISOString();
}

export function yesterdaySlot(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * First step of a run. SET NX EX. The same run may retry this step and still
 * owns the key. A second start() for the slot throws FatalError before any
 * upstream call.
 *
 * Without Upstash the lock is skipped so local ingest can still run. The
 * request path then reads Tinybird directly. See AGENTS.md.
 */
export async function takeWorkflowSlot(
  job: WorkflowJob,
  slot: string,
  owner: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[workflow] redis unset; slot lock skipped");
    return;
  }

  const key = workflowSlotKey(job, slot);
  const locked = await redis.set(key, owner, { nx: true, ex: SLOT_TTL_SECONDS[job] });
  if (locked === "OK") {
    return;
  }

  const current = await redis.get<string>(key);
  if (current === owner) {
    return;
  }

  throw new FatalError(`workflow slot held: ${job}`);
}
