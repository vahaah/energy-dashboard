import {
  BlobNotFoundError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobUnknownError,
  type GetBlobResult,
} from "@vercel/blob";

/** One attempt, then two waits. A build must not sit on a dead Blob store. */
export const BLOB_READ_ATTEMPTS = 3;
export const BLOB_READ_BACKOFF_MS = [200, 800] as const;

export function isTransientBlobError(error: unknown): boolean {
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

/** Retries a transient Blob failure. A missing object and any other error propagate immediately. */
export async function withBlobReadRetry<T>(
  read: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = delay,
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < BLOB_READ_ATTEMPTS; attempt += 1) {
    try {
      return await read();
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
): Promise<{ body: string; uploadedAt: Date; size: number } | null> {
  try {
    return await withBlobReadRetry(async () => {
      const result = await read();
      if (!result || result.statusCode !== 200 || !result.stream) {
        return null;
      }
      const body = await new Response(result.stream).text();
      return { body, uploadedAt: result.blob.uploadedAt, size: result.blob.size ?? 0 };
    }, sleep);
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
