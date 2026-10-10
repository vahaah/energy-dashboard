import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearQueryCache,
  getQueryEntry,
  prefetchQuery,
  revalidateAllQueries,
} from "@/lib/client-query";

describe("client query cache", () => {
  afterEach(() => {
    clearQueryCache();
  });

  it("dedupes in-flight fetches and keeps previous data on the next key", async () => {
    const fetcher = vi.fn(async () => ({ rows: [1] }));
    const first = prefetchQuery("day", fetcher);
    const second = prefetchQuery("day", fetcher);
    await expect(Promise.all([first, second])).resolves.toEqual([{ rows: [1] }, { rows: [1] }]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(getQueryEntry("day")?.data).toEqual({ rows: [1] });
  });

  it("keeps the last value while a forced revalidate is in flight", async () => {
    await prefetchQuery("week", async () => "old");
    let resolveFresh: (value: string) => void = () => undefined;
    const pending = new Promise<string>((resolve) => {
      resolveFresh = resolve;
    });
    const revalidate = prefetchQuery("week", () => pending, { force: true });
    expect(getQueryEntry<string>("week")?.data).toBe("old");
    expect(getQueryEntry("week")?.promise).toBeTruthy();
    resolveFresh("new");
    await expect(revalidate).resolves.toBe("new");
    expect(getQueryEntry<string>("week")?.data).toBe("new");
  });

  it("revalidates registered keys", async () => {
    const fetcher = vi.fn(async () => 1);
    await prefetchQuery("all", fetcher);
    fetcher.mockResolvedValue(2);
    revalidateAllQueries();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
