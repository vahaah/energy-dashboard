import { FatalError } from "workflow";
import { getRedis } from "@/lib/redis-cache";
import { jsonBytes } from "@/lib/step-status";

const BODY_TTL_SECONDS = 3_600;
const memoryBodies = new Map<string, unknown>();

export function resetWorkflowBodyMemoryForTests(): void {
  memoryBodies.clear();
}

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

  const key = workflowBodyKey(job, slot, name);
  const redis = getRedis();
  if (!redis) {
    memoryBodies.set(key, value);
    return bytes;
  }

  await redis.set(key, value, { ex: BODY_TTL_SECONDS });
  return bytes;
}

export async function readWorkflowBody<T>(
  job: string,
  slot: string,
  name: string
): Promise<T | null> {
  const key = workflowBodyKey(job, slot, name);
  const redis = getRedis();
  if (!redis) {
    const stored = memoryBodies.get(key);
    return stored == null ? null : (stored as T);
  }

  const value = await redis.get<T | string>(key);
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
