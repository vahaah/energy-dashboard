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
    const response = proxy(
      new NextRequest("http://localhost/api/unknown", {
        headers: { "x-forwarded-for": "203.0.113.20" },
      })
    );
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).not.toBeNull();
  });

  it("enforces 60/min on cacheable GETs without emitting X-RateLimit headers on allowed responses", () => {
    const headers = { "x-forwarded-for": "203.0.113.10" };
    const request = () =>
      proxy(new NextRequest("http://localhost/api/dashboard?period=week", { headers }));

    const first = request();
    expect(first.status).not.toBe(429);
    expect(first.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect(first.headers.get("X-RateLimit-Limit")).toBeNull();

    for (let remaining = 59; remaining > 0; remaining -= 1) {
      const response = request();
      expect(response.status).not.toBe(429);
      expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
    }

    const blocked = request();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});
