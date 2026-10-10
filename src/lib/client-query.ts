type CacheEntry<T> = {
  data: T | undefined;
  error: Error | undefined;
  promise: Promise<T> | undefined;
  updatedAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const fetchers = new Map<string, () => Promise<unknown>>();

function emit(key: string): void {
  const set = listeners.get(key);
  if (!set) {
    return;
  }
  for (const listener of set) {
    listener();
  }
}

export function subscribeQuery(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export function getQueryEntry<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined;
}

export const CLIENT_QUERY_MAX_AGE_MS = 5 * 60 * 1000;

export function clearQueryCache(): void {
  cache.clear();
  fetchers.clear();
}

export function isFreshQueryEntry(entry: CacheEntry<unknown>, now = Date.now()): boolean {
  return entry.data !== undefined && now - entry.updatedAt < CLIENT_QUERY_MAX_AGE_MS;
}

export async function prefetchQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { force?: boolean }
): Promise<T> {
  fetchers.set(key, fetcher);
  const existing = getQueryEntry<T>(key);
  if (!options?.force && existing && isFreshQueryEntry(existing) && existing.promise === undefined) {
    return existing.data as T;
  }
  if (!options?.force && existing?.promise) {
    return existing.promise;
  }

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, error: undefined, promise: undefined, updatedAt: Date.now() });
      emit(key);
      return data;
    })
    .catch((error: Error) => {
      cache.set(key, {
        data: existing?.data,
        error,
        promise: undefined,
        updatedAt: existing?.updatedAt ?? 0,
      });
      emit(key);
      throw error;
    });

  cache.set(key, {
    data: existing?.data,
    error: undefined,
    promise,
    updatedAt: existing?.updatedAt ?? 0,
  });
  emit(key);
  return promise;
}

export function revalidateAllQueries(): void {
  for (const [key, fetcher] of fetchers) {
    if ((listeners.get(key)?.size ?? 0) === 0) {
      continue;
    }
    void prefetchQuery(key, fetcher, { force: true });
  }
}

export function revalidateQuery(key: string): void {
  const fetcher = fetchers.get(key);
  if (!fetcher) {
    return;
  }
  void prefetchQuery(key, fetcher, { force: true });
}
