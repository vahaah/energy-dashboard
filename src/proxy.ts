import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  API_CDN_VARY,
  isEdgeCacheableApi,
  withoutFlightHeaders,
} from "@/lib/edge-cacheable-api";
import { INDEXNOW_KEY_PATH } from "@/lib/indexnow";
import { PLAUSIBLE_EVENT_PATH } from "@/lib/plausible";

export { isEdgeCacheableApi } from "@/lib/edge-cacheable-api";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const PRUNE_INTERVAL_MS = 30_000;
const store = new Map<string, { count: number; resetAt: number }>();
let lastPruneAt = 0;

const WORKFLOW_WELL_KNOWN = "/.well-known/workflow/";

const CRON_OR_HEALTH = new Set([
  "/api/cron",
  "/api/cron-warm",
  "/api/cron-prices",
  "/api/cron-yesterday",
  "/api/cron-map-layers",
  "/api/cron-gas",
  "/api/cron-constraints",
  "/api/cron-directory",
  "/api/cron-tec",
  "/api/cron-northern-ireland",
  "/api/cron-power-cuts",
  "/api/health",
]);

function pruneExpired(now: number): void {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) {
    return;
  }
  lastPruneAt = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

function checkLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  pruneExpired(now);
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

function corsHeaders(pathname: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  const methods =
    pathname === "/api/v1/identifiers/resolve" || pathname === "/api/v1/postcode"
      ? "GET, POST, OPTIONS"
      : "GET, OPTIONS";
  headers.set("Access-Control-Allow-Methods", methods);
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return headers;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Workflow runtime posts here. Never rate-limit it, even if the matcher widens.
  if (pathname.startsWith(WORKFLOW_WELL_KNOWN)) {
    return NextResponse.next();
  }

  // Public IndexNow key file. The matcher covers /api and the workflow callback.
  if (pathname === INDEXNOW_KEY_PATH) {
    return NextResponse.next();
  }

  // Plausible beacon. Do not count it against the public API budget, and do
  // not forward cookies to plausible.io. The rewrite lives in next.config.ts.
  if (pathname === PLAUSIBLE_EVENT_PATH) {
    const headers = new Headers(request.headers);
    // Override headers only replace names that are still present. An empty
    // Cookie is what actually drops the inbound cookie before the rewrite.
    headers.set("cookie", "");
    return NextResponse.next({ request: { headers } });
  }

  if (CRON_OR_HEALTH.has(pathname)) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const headers = corsHeaders(pathname);

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

  const response = cacheableGet
    ? NextResponse.next({
        request: { headers: withoutFlightHeaders(request.headers) },
      })
    : NextResponse.next();
  if (cacheableGet) {
    response.headers.set("Vary", API_CDN_VARY);
  }
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/.well-known/workflow/:path*"],
};
