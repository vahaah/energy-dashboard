import {
  FETCH_BACKOFF_MS,
  FETCH_JITTER_MS,
  FETCH_MAX_BYTES,
  FETCH_MAX_RETRIES,
  FETCH_TIMEOUT_MS,
} from "@/lib/power-cuts/schema";

export class PowerCutFetchError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "PowerCutFetchError";
    this.retryable = retryable;
  }
}

export type FetchBoundedOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  jitter?: () => number;
  timeoutMs?: number;
  maxRetries?: number;
  maxBytes?: number;
  init?: RequestInit;
};

function retryableStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return false;
  }
  const name = String(error.name);
  return name === "TimeoutError" || name === "AbortError";
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PowerCutFetchError("response larger than 10 MB", false);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new PowerCutFetchError("response larger than 10 MB", false);
    }
    return text;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    received += next.value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new PowerCutFetchError("response larger than 10 MB", false);
    }
    chunks.push(next.value);
  }
  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/** One attempt plus at most two retries, only for HTTP 5xx and timeouts. */
export async function fetchBounded(url: string, options: FetchBoundedOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const jitter = options.jitter ?? (() => Math.floor(Math.random() * (FETCH_JITTER_MS + 1)));
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? FETCH_MAX_RETRIES;
  const maxBytes = options.maxBytes ?? FETCH_MAX_BYTES;
  let last: Error = new PowerCutFetchError("fetch failed", true);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...options.init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new PowerCutFetchError(`HTTP ${response.status}`, retryableStatus(response.status));
      }
      return await readCapped(response, maxBytes);
    } catch (error) {
      const wrapped =
        error instanceof PowerCutFetchError
          ? error
          : new PowerCutFetchError(isTimeout(error) ? "timed out" : "fetch failed", isTimeout(error));
      last = wrapped;
      const retry = wrapped.retryable && attempt < maxRetries;
      if (!retry) {
        throw wrapped;
      }
      const backoff = FETCH_BACKOFF_MS[attempt] ?? FETCH_BACKOFF_MS[FETCH_BACKOFF_MS.length - 1] ?? 800;
      await sleep(backoff + jitter());
    }
  }
  throw last;
}
