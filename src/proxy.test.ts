import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { API_CDN_VARY } from "@/lib/edge-cacheable-api";
import { INDEXNOW_KEY_PATH } from "@/lib/indexnow";
import { PLAUSIBLE_EVENT_PATH } from "@/lib/plausible";
import { config, isEdgeCacheableApi, proxy } from "@/proxy";

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

  it("pins cacheable GET Vary to Accept-Encoding and strips flight headers", () => {
    const response = proxy(
      new NextRequest("http://localhost/api/dashboard?period=week", {
        headers: {
          accept: "application/json",
          rsc: "1",
          "next-router-state-tree": "unique-tree",
          "next-router-prefetch": "1",
        },
      })
    );
    expect(response.headers.get("Vary")).toBe(API_CDN_VARY);
    expect(response.headers.get("x-middleware-request-rsc")).toBeNull();
    expect(response.headers.get("x-middleware-request-next-router-state-tree")).toBeNull();
    expect(response.headers.get("x-middleware-request-accept")).toBe("application/json");
    expect(response.headers.get("x-middleware-override-headers")).toContain("accept");
    expect(response.headers.get("x-middleware-override-headers")).not.toMatch(
      /(?:^|,)rsc(?:,|$)/
    );
  });

  it("does not rate-limit Plausible events and strips cookies before the rewrite", () => {
    const headers = { "x-forwarded-for": "203.0.113.50", cookie: "session=secret" };
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const response = proxy(
        new NextRequest(`http://localhost${PLAUSIBLE_EVENT_PATH}`, {
          method: "POST",
          headers,
        }),
      );
      expect(response.status).not.toBe(429);
      expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
      expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
    }

    const response = proxy(
      new NextRequest(`http://localhost${PLAUSIBLE_EVENT_PATH}`, {
        method: "POST",
        headers,
      }),
    );
    expect(response.headers.get("x-middleware-override-headers")).toContain("cookie");
    expect(response.headers.get("x-middleware-request-cookie")).toBe("");
  });

  it("does not rate-limit the public IndexNow key file", () => {
    expect(config.matcher).toEqual(["/api/:path*", "/.well-known/workflow/:path*"]);
    const headers = { "x-forwarded-for": "203.0.113.79" };
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const response = proxy(
        new NextRequest(`http://localhost${INDEXNOW_KEY_PATH}`, { headers })
      );
      expect(response.status).not.toBe(429);
      expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
      expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
    }
  });

  it("does not rate-limit the workflow callback", () => {
    const headers = { "x-forwarded-for": "203.0.113.80" };
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const response = proxy(
        new NextRequest("http://localhost/.well-known/workflow/v1/flow", {
          method: "POST",
          headers,
        })
      );
      expect(response.status).not.toBe(429);
      expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    }
  });
});
