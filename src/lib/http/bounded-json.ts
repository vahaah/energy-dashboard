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
 * Each attempt dies after 8 seconds. A caller abort stops the loop.
 */
export async function fetchBoundedJson(url: string, parent?: AbortSignal): Promise<unknown> {
  let last: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (parent?.aborted) {
      throw parent.reason ?? new DOMException("The request was aborted.", "AbortError");
    }
    try {
      const signal = parent ? AbortSignal.any([parent, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS);
      const response = await fetch(url, { signal });
      if (response.status === 429 || response.status >= 500) {
        last = new Error(`HTTP ${response.status}`);
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
