export async function fetchJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = 12_000, ...init } = options ?? {};
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
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
