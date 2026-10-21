import { FatalError, RetryableError } from "workflow";
import { recordJobFailure, type CronJobId } from "@/lib/job-health";
import { stepAttempt } from "@/lib/step-attempt";

/**
 * Workflow step results ride the event log. The runtime frames events at 10 MB
 * and Redis workflow bodies stop at 2 MB. Extracts under this go to the next
 * step in memory. Larger ones stay in Blob and are re-read with a bounded retry.
 */
export const STEP_INLINE_MAX_BYTES = 1_500_000;

/** Five reads. The four waits sum to 14s. */
export const BLOB_READBACK_ATTEMPTS = 5;
export const BLOB_READBACK_BACKOFF_MS = [2_000, 3_000, 4_000, 5_000] as const;

const READBACK_RETRY_MS = 15_000;

let sleepImpl: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function setBlobReadbackSleepForTests(sleep: ((ms: number) => Promise<void>) | null): void {
  sleepImpl =
    sleep ??
    ((ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }));
}

export function fitsInline(bytes: number): boolean {
  return bytes <= STEP_INLINE_MAX_BYTES;
}

/** Vercel Blob's already-exists failure, plus the in-memory stores' `blob exists:` error. */
export function isBlobAlreadyExists(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  if ("code" in error && (error as { code?: unknown }).code === "blob_already_exists") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /already exists/i.test(message) || /\bblob exists:/i.test(message);
}

/**
 * `put(allowOverwrite: false)` with no preceding get. A cached 404 must not
 * decide whether the object is there. "Already exists" is success. Any other
 * rejection checks once, uncached, in case the SDK dropped the API message.
 */
export async function putImmutable(put: () => Promise<void>, confirm: () => Promise<boolean>): Promise<void> {
  try {
    await put();
  } catch (error) {
    if (isBlobAlreadyExists(error)) {
      return;
    }
    let present = false;
    try {
      present = await confirm();
    } catch {
      present = false;
    }
    if (present) {
      return;
    }
    throw error;
  }
}

/**
 * Not-found is not fatal on the first attempts. The step's own `maxRetries`
 * bounds the outer loop. The last attempt is a FatalError so the run stops.
 */
export function blobReadbackError(message: string, maxRetries: number, attempt = stepAttempt()): Error {
  if (attempt > maxRetries) {
    return new FatalError(message);
  }
  return new RetryableError(message, { retryAfter: READBACK_RETRY_MS });
}

export async function readUntilPresent<T>(
  read: () => Promise<T | null>,
  onMiss?: (attempt: number) => void,
): Promise<T | null> {
  for (let attempt = 0; attempt < BLOB_READBACK_ATTEMPTS; attempt += 1) {
    const hit = await read();
    if (hit) {
      return hit;
    }
    onMiss?.(attempt + 1);
    const wait = BLOB_READBACK_BACKOFF_MS[attempt];
    if (wait == null) {
      break;
    }
    await sleepImpl(wait);
  }
  return null;
}

/** Count a finished failure. A RetryableError still inside maxRetries is not a streak. */
export async function observeJobFailure(
  job: CronJobId,
  error: unknown,
  maxRetries: number,
  attempt = stepAttempt(),
): Promise<void> {
  if (error instanceof RetryableError && attempt <= maxRetries) {
    return;
  }
  const message = error instanceof Error ? error.message : "cron step failed";
  await recordJobFailure(job, message);
}
