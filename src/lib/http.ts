import { readThroughCache } from "@/lib/redis-cache";
import type { TinybirdCachePolicy } from "@/lib/tinybird-cache";

type FetchOptions = RequestInit & {
  timeoutMs?: number;
  cacheKey?: string;
  cachePolicy?: TinybirdCachePolicy;
};

function requestInitWithoutCache(options?: FetchOptions): RequestInit {
  if (!options) {
    return {};
  }

  const init: RequestInit = {};
  if (options.method) init.method = options.method;
  if (options.headers) init.headers = options.headers;
  if (options.body) init.body = options.body;
  if (options.cache) init.cache = options.cache;
  if ("next" in options && options.next) {
    init.next = options.next;
  }
  return init;
}

async function fetchOk(url: string, options?: FetchOptions): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const init = requestInitWithoutCache(options);
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response;
}

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  const { cacheKey, cachePolicy, ...fetchOptions } = options ?? {};
  const load = async () => {
    const response = await fetchOk(url, fetchOptions);
    return (await response.json()) as T;
  };

  if (!cacheKey || !cachePolicy) {
    return load();
  }

  return readThroughCache(cacheKey, cachePolicy, load);
}

export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  const response = await fetchOk(url, options);
  return await response.text();
}

export async function fetchBytes(url: string, options?: FetchOptions): Promise<Uint8Array> {
  const response = await fetchOk(url, options);
  return new Uint8Array(await response.arrayBuffer());
}

export type SourceStatus = {
  source: string;
  ok: boolean;
  rows?: number;
  error?: string;
};

export type CollectionResult = {
  rows: Record<string, unknown>[];
  sources: SourceStatus[];
};

export function sourceStatusesHaveFailure(statuses: SourceStatus[]): boolean {
  return statuses.some((status) => !status.ok);
}

export function collectionIfSourcesOk(
  rows: Record<string, unknown>[],
  sources: SourceStatus[]
): CollectionResult {
  if (sourceStatusesHaveFailure(sources)) {
    return { rows: [], sources };
  }
  return { rows, sources };
}
