type FetchOptions = RequestInit & {
  timeoutMs?: number;
};

async function fetchOk(url: string, options?: FetchOptions): Promise<Response> {
  const { timeoutMs = 12_000, ...init } = options ?? {};
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
  const response = await fetchOk(url, options);
  return (await response.json()) as T;
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
