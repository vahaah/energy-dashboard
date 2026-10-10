"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getQueryEntry, prefetchQuery, subscribeQuery } from "@/lib/client-query";

type QueryView<T> = {
  data: T | undefined;
  error: Error | undefined;
  promise: Promise<T> | undefined;
};

export function visibleClientQueryData<T>(
  cached: QueryView<T> | undefined,
  previous: T | undefined
): T | undefined {
  if (cached?.data !== undefined) {
    return cached.data;
  }
  if (cached?.error) {
    return undefined;
  }
  return previous;
}

export function useClientQuery<T>(key: string, fetcher: () => Promise<T>) {
  const cached = useSyncExternalStore(
    (listener) => subscribeQuery(key, listener),
    () => getQueryEntry<T>(key),
    () => undefined
  );

  useEffect(() => {
    void prefetchQuery(key, fetcher).catch(() => undefined);
  }, [key, fetcher]);

  const [previous, setPrevious] = useState<T | undefined>(undefined);
  if (cached?.data !== undefined && cached.data !== previous) {
    setPrevious(cached.data);
  }

  const data = visibleClientQueryData(cached, previous);
  return {
    data,
    error: cached?.error,
    isLoading: data === undefined && cached?.error === undefined,
    isValidating: cached?.promise !== undefined,
  };
}
