import { NextResponse } from "next/server";
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
  };
}

export function cachedJson(data: unknown, policy: TinybirdCachePolicy) {
  return NextResponse.json(data, {
    headers: cdnCacheHeaders(tinybirdCacheControl(policy)),
  });
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
