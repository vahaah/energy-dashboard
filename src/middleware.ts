import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware: rate limiting for /api/* routes (except cron, which has its own auth).
 * Uses in-memory counting at the edge. For production Upstash,
 * rate limiting is handled inside the route handlers.
 *
 * This middleware adds CORS headers so the API is publicly consumable.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const store = new Map<string, { count: number; resetAt: number }>();

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip cron route (has its own Bearer auth)
  if (pathname === "/api/cron") {
    return NextResponse.next();
  }

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  const { allowed, remaining } = checkLimit(ip);

  // CORS + rate limit headers
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  headers.set("X-RateLimit-Remaining", String(remaining));

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Limit: 60/min." },
      { status: 429, headers }
    );
  }

  const response = NextResponse.next();
  // Append headers to actual response
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
