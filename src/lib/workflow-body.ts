import { FatalError, RetryableError } from "workflow";
import { getRedis } from "@/lib/redis-cache";
import { jsonBytes } from "@/lib/step-status";

const BODY_TTL_SECONDS = 3_600;
/** Ingest handoff only. Dashboard envelopes and catalogue bodies stay smaller. */
const MAX_BODY_BYTES = 2_000_000;

export function workflowBodyKey(job: string, slot: string, name: string): string {
  return `grid:wf-body:${job}:${slot}:${name}`;
}

export async function writeWorkflowBody(
  job: string,
  slot: string,
  name: string,
  value: unknown
): Promise<number> {
  const bytes = jsonBytes(value);
  if (bytes > MAX_BODY_BYTES) {
    throw new FatalError(`workflow body ${name} is ${bytes} bytes`);
  }

  const redis = getRedis();
  if (!redis) {
    throw new RetryableError("redis unavailable for workflow body", { retryAfter: "30s" });
  }

  await redis.set(workflowBodyKey(job, slot, name), value, { ex: BODY_TTL_SECONDS });
  return bytes;
}

export async function readWorkflowBody<T>(
  job: string,
  slot: string,
  name: string
): Promise<T | null> {
  const redis = getRedis();
  if (!redis) {
    throw new RetryableError("redis unavailable for workflow body", { retryAfter: "30s" });
  }

  const value = await redis.get<T | string>(workflowBodyKey(job, slot, name));
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value;
}
