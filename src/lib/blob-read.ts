import {
  BlobNotFoundError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobUnknownError,
  type GetBlobResult,
} from "@vercel/blob";

/** One attempt, then two retries. A build must not sit on a dead Blob store. */
export const BLOB_READ_ATTEMPTS = 3;
export const BLOB_READ_BACKOFF_MS = [200, 800] as const;
/** Hard stop for one SDK `get` or `list`. Retries do not start until this fires. */
export const BLOB_READ_TIMEOUT_MS = 10_000;

export function blobReadSignal(timeoutMs = BLOB_READ_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

export function isTransientBlobError(error: unknown): boolean {
  if (isDeadlineError(error)) {
    return true;
  }
  if (error instanceof BlobNotFoundError) {
    return false;
  }
  if (
    error instanceof BlobServiceNotAvailable ||
    error instanceof BlobServiceRateLimited ||
    error instanceof BlobUnknownError
  ) {
    return true;
  }
  const status = blobStatus(error);
  if (status === 429 || (status != null && status >= 500 && status < 600)) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  if (/Failed to fetch blob:/.test(error.message)) {
    return /Failed to fetch blob: (?:429|5\d\d)\b/.test(error.message);
  }
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|socket hang up|Network request failed|Network request timed out|^fetch failed$|^Failed to fetch$/i.test(
    error.message,
  );
}

function blobStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const record = error as { status?: unknown; statusCode?: unknown };
  if (typeof record.status === "number") {
    return record.status;
  }
  if (typeof record.statusCode === "number") {
    return record.statusCode;
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isDeadlineError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return false;
  }
  return error.name === "TimeoutError" || error.name === "AbortError";
}

/** Rejects when the SDK call never settles. The caller also passes `blobReadSignal` so undici aborts. */
function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  const signal = AbortSignal.timeout(ms);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason);
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/** Retries a transient Blob failure. A missing object and any other error propagate immediately. */
export async function withBlobReadRetry<T>(
  read: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = delay,
  timeoutMs: number = BLOB_READ_TIMEOUT_MS,
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < BLOB_READ_ATTEMPTS; attempt += 1) {
    try {
      return await deadline(read(), timeoutMs);
    } catch (error) {
      if (!isTransientBlobError(error)) {
        throw error;
      }
      last = error;
      const wait = BLOB_READ_BACKOFF_MS[attempt];
      if (wait != null) {
        await sleep(wait);
      }
    }
  }
  throw last instanceof Error ? last : new Error("Vercel Blob read failed");
}

/**
 * Shared `get` body. A 404 from the SDK is `null`. A transient error is retried,
 * then rethrown so ingest stays fail-closed. Page readers catch that rethrow.
 */
export async function readBlobResponse(
  read: () => Promise<GetBlobResult | null>,
  sleep?: (ms: number) => Promise<void>,
  timeoutMs: number = BLOB_READ_TIMEOUT_MS,
): Promise<{ body: string; uploadedAt: Date; size: number } | null> {
  try {
    return await withBlobReadRetry(async () => {
      const result = await read();
      if (!result || result.statusCode !== 200 || !result.stream) {
        return null;
      }
      const body = await new Response(result.stream).text();
      return { body, uploadedAt: result.blob.uploadedAt, size: result.blob.size ?? 0 };
    }, sleep, timeoutMs);
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    throw error;
  }
}

/** Page and health reads. After the store has retried, a transient failure is a missing object. */
export async function blobReadOrNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (isTransientBlobError(error)) {
      return null;
    }
    throw error;
  }
}
