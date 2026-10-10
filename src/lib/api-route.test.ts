import { describe, expect, it } from "vitest";
import { cachedJson, upstreamError } from "@/lib/api-route";
import { TinybirdLimitError, getTinybirdCachePolicy } from "@/lib/tinybird-cache";

describe("API error and cache helpers", () => {
  it("returns 503 with Retry-After for Tinybird limit errors", async () => {
    const response = upstreamError(
      new TinybirdLimitError("Tinybird query error (429): daily request limit exceeded", 300)
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(body.error).toBe("Upstream temporarily unavailable");
  });

  it("keeps 502 for ordinary upstream failures", async () => {
    const response = upstreamError(new Error("Tinybird query error (502): timeout"));
    expect(response.status).toBe(502);
    expect(response.headers.get("Retry-After")).toBeNull();
  });

  it("attaches CDN Cache-Control from the Tinybird policy", () => {
    const policy = getTinybirdCachePolicy({
      pipeName: "snapshots_range",
      range: "24h",
      date: "2026-05-19",
      now: new Date("2026-10-02T12:00:00.000Z"),
    });
    const response = cachedJson({ data: [] }, policy);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );
    expect(response.headers.get("Cache-Tag")).toBe("dashboard");
  });
});
