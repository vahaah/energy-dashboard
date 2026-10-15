import { describe, expect, it } from "vitest";
import { loadSearchIndex, resetSearchIndexCache } from "@/lib/assets/search-index";

describe("search index fetch", () => {
  it("retries after a failed fetch and then caches the index", async () => {
    resetSearchIndexCache();
    let calls = 0;
    const fetchIndex = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("no", { status: 500 });
      }
      return Response.json({ version: 1, rows: [] });
    }) as typeof fetch;

    await expect(loadSearchIndex(fetchIndex)).rejects.toThrow("asset index 500");
    await expect(loadSearchIndex(fetchIndex)).resolves.toEqual([]);
    await expect(loadSearchIndex(fetchIndex)).resolves.toEqual([]);
    expect(calls).toBe(2);
  });
});
