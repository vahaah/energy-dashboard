import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { peekOgCacheSnapshot } from "@/lib/og/peek";
import { resetRedisClient } from "@/lib/redis-cache";

describe("og cache peek", () => {
  afterEach(() => {
    resetRedisClient();
  });

  it("never imports Tinybird query or an uncached dashboard load", () => {
    const peek = readFileSync(resolve(import.meta.dirname, "./peek.ts"), "utf8");
    const response = readFileSync(resolve(import.meta.dirname, "./response.tsx"), "utf8");
    const route = readFileSync(resolve(process.cwd(), "src/app/og/route.tsx"), "utf8");

    expect(peek).toContain("peekThroughCache");
    expect(peek).toContain("prices_range");
    expect(peek).not.toContain("latest_prices");
    expect(peek).not.toContain("queryPipe");
    expect(peek).not.toContain("loadDashboardPayloadUncached");
    expect(peek).not.toContain("fetchPipeRows");
    expect(response).toContain("peekOgCacheSnapshot");
    expect(response).not.toContain("queryPipe");
    expect(route).toContain("renderOgImageResponse");
    expect(route).not.toContain("queryPipe");
  });

  it("returns empty snapshot fields when Redis is absent instead of loading Tinybird", async () => {
    resetRedisClient();
    await expect(peekOgCacheSnapshot(new Date("2026-10-10T12:00:00.000Z"))).resolves.toEqual({
      facts: null,
      records: null,
      prices: null,
    });
  });
});
