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

export function sourceStatusesHaveFailure(statuses: SourceStatus[]): boolean {
  return statuses.some((status) => !status.ok);
}
