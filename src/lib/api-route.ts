import { NextResponse } from "next/server";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
import { API_CDN_VARY } from "@/lib/edge-cacheable-api";
import {
  TinybirdLimitError,
  tinybirdCacheControl,
  type TinybirdCachePolicy,
} from "@/lib/tinybird-cache";

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function cdnCacheHeaders(cacheControl: string): Record<string, string> {
  return {
    "Cache-Control": cacheControl,
    "CDN-Cache-Control": cacheControl,
    "Vercel-CDN-Cache-Control": cacheControl,
    "Cache-Tag": DASHBOARD_CACHE_TAG,
  };
}

export function cachedJson(
  data: unknown,
  policy: TinybirdCachePolicy,
  extraHeaders?: Record<string, string>
) {
  const response = NextResponse.json(data, {
    headers: {
      ...cdnCacheHeaders(tinybirdCacheControl(policy)),
      Vary: API_CDN_VARY,
      ...extraHeaders,
    },
  });
  response.headers.delete("Set-Cookie");
  return response;
}

export function upstreamError(error: unknown) {
  if (error instanceof TinybirdLimitError) {
    return NextResponse.json(
      { error: "Upstream temporarily unavailable", detail: error.message },
      {
        status: 503,
        headers: { "Retry-After": String(error.retryAfterSeconds) },
      }
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: "Upstream query failed", detail: message }, { status: 502 });
}
