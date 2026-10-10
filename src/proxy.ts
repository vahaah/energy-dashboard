import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const store = new Map<string, { count: number; resetAt: number }>();

const CRON_OR_HEALTH = new Set([
  "/api/cron",
  "/api/cron-prices",
  "/api/cron-yesterday",
  "/api/health",
]);

const EDGE_CACHEABLE = new Set([
  "/api/dashboard",
  "/api/prices",
  "/api/look-ahead",
  "/api/snapshots",
  "/api/generation",
  "/api/interconnectors",
]);

function checkLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
  };
}

function corsHeaders(): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return headers;
}

export function isEdgeCacheableApi(pathname: string, method: string): boolean {
  return method === "GET" && EDGE_CACHEABLE.has(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (CRON_OR_HEALTH.has(pathname)) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const cacheableGet = isEdgeCacheableApi(pathname, request.method);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  const { allowed, remaining } = checkLimit(ip);

  if (!allowed) {
    headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    headers.set("X-RateLimit-Remaining", String(remaining));
    return NextResponse.json(
      { error: "Too many requests. Limit: 60/min." },
      { status: 429, headers }
    );
  }

  if (!cacheableGet) {
    headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    headers.set("X-RateLimit-Remaining", String(remaining));
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
