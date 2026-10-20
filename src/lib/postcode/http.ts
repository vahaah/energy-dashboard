/** One attempt, then two retries. The caller chooses the deadline. */
export const NETWORK_ATTEMPTS = 3;
export const NETWORK_BACKOFF_MS = [200, 800] as const;
export const NETWORK_TIMEOUT_MS = 10_000;

export class BoundedHttpError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = "BoundedHttpError";
    this.status = status;
    this.retryable = retryable;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type BoundedFetch = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Hard timeout on the request, including the body the caller reads from the
 * returned response (the same `AbortSignal`). 429 and 5xx retry. Other HTTP
 * statuses do not.
 */
export async function fetchBounded(url: string, options: BoundedFetch = {}): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? NETWORK_TIMEOUT_MS;
  const sleep = options.sleep ?? delay;
  let last: unknown;
  for (let attempt = 0; attempt < NETWORK_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        throw new BoundedHttpError(`HTTP ${response.status}`, response.status, true);
      }
      if (!response.ok) {
        throw new BoundedHttpError(`HTTP ${response.status}`, response.status, false);
      }
      return response;
    } catch (error) {
      if (error instanceof BoundedHttpError && !error.retryable) {
        throw error;
      }
      last = error;
      const wait = NETWORK_BACKOFF_MS[attempt];
      if (wait == null) {
        break;
      }
      await sleep(wait);
    }
  }
  throw last instanceof Error ? last : new BoundedHttpError("request failed", null, true);
}
