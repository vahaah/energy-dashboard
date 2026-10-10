import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isEdgeCacheableApi, proxy } from "@/proxy";

describe("edge-cacheable API proxy", () => {
  it("does not attach rate-limit headers to /api/dashboard", async () => {
    expect(isEdgeCacheableApi("/api/dashboard", "GET")).toBe(true);
    expect(isEdgeCacheableApi("/api/prices", "GET")).toBe(true);
    expect(isEdgeCacheableApi("/api/dashboard", "POST")).toBe(false);

    const response = proxy(new NextRequest("http://localhost/api/dashboard?period=week"));
    expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("still rate-limits non-cacheable API routes", () => {
    const response = proxy(new NextRequest("http://localhost/api/unknown"));
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).not.toBeNull();
  });
});
