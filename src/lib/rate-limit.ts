/**
 * Rate limiting with two strategies:
 *
 * 1. Upstash Redis (production) — if UPSTASH_REDIS_REST_URL is set
 * 2. In-memory Map (dev / fallback) — works locally, resets on cold start
 *
 * Both use a sliding window: 60 requests per minute per IP.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── In-memory fallback ─────────────────────────────────────

interface WindowEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, WindowEntry>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60;

function memoryRateLimit(ip: string): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const entry = memoryStore.get(ip);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { success: true, remaining: MAX_REQUESTS - 1, reset: now + WINDOW_MS };
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  return { success: true, remaining: MAX_REQUESTS - entry.count, reset: entry.resetAt };
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 300_000);
}

// ─── Upstash Redis (production) ─────────────────────────────

let upstashLimiter: { limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number }> } | null = null;

async function getUpstashLimiter() {
  if (upstashLimiter) return upstashLimiter;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  upstashLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, "1 m"),
    analytics: true,
    prefix: "energy-dashboard",
  });

  return upstashLimiter;
}

// ─── Public API ─────────────────────────────────────────────

export async function rateLimit(request: NextRequest): Promise<NextResponse | null> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  let result: { success: boolean; remaining: number; reset: number };

  const limiter = await getUpstashLimiter();
  if (limiter) {
    result = await limiter.limit(ip);
  } else {
    result = memoryRateLimit(ip);
  }

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null; // Allowed
}

/**
 * Helper to add rate limit headers to a successful response.
 */
export function withRateLimitHeaders(
  response: NextResponse,
  remaining: number = MAX_REQUESTS
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
