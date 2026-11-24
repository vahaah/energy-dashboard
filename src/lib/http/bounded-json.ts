const ATTEMPTS = 3;
const TIMEOUT_MS = 8_000;
const BACKOFF_MS = [200, 800] as const;

function delay(ms: number, parent?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      parent?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(parent?.reason ?? new DOMException("The request was aborted.", "AbortError"));
    };
    if (parent?.aborted) {
      onAbort();
      return;
    }
    parent?.addEventListener("abort", onAbort, { once: true });
  });
}

function retryable(error: unknown): boolean {
  if (error instanceof Error && /^HTTP 4\d\d$/.test(error.message) && error.message !== "HTTP 429") {
    return false;
  }
  return true;
}

/**
 * One attempt, then two retries. 429 and 5xx wait 200ms then 800ms.
 * Each attempt dies after 8 seconds. A 4xx other than 429 is returned.
 * A caller abort stops the loop. `readJson` keeps the body read inside the
 * same loop, so a download that dies after the headers still retries.
 */
async function fetchBoundedAttempt(
  url: string,
  init: RequestInit | undefined,
  parent: AbortSignal | undefined,
  fetchImpl: typeof fetch,
  readJson: boolean,
): Promise<Response | unknown> {
  let last: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (parent?.aborted) {
      throw parent.reason ?? new DOMException("The request was aborted.", "AbortError");
    }
    try {
      const signal = parent ? AbortSignal.any([parent, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS);
      const response = await fetchImpl(url, { ...init, signal });
      if (response.status === 429 || response.status >= 500) {
        last = new Error(`HTTP ${response.status}`);
      } else if (!readJson) {
        return response;
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      } else {
        return await response.json();
      }
    } catch (error) {
      if (parent?.aborted) {
        throw error;
      }
      if (!retryable(error)) {
        throw error;
      }
      last = error;
    }
    if (attempt < ATTEMPTS - 1) {
      await delay(BACKOFF_MS[attempt] ?? 800, parent);
    }
  }
  throw last instanceof Error ? last : new Error("The request failed.");
}

export function fetchBounded(
  url: string,
  init?: RequestInit,
  parent?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return fetchBoundedAttempt(url, init, parent, fetchImpl, false) as Promise<Response>;
}

export function fetchBoundedJson(
  url: string,
  parent?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return fetchBoundedAttempt(url, undefined, parent, fetchImpl, true);
}
