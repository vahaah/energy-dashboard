import { NextResponse } from "next/server";
import { API_ERROR_SOURCE_UNAVAILABLE, scopeRejection, unsupportedFilter } from "@/lib/api/errors";
import { cdnCacheHeaders } from "@/lib/api-route";
import { loadDataHealth } from "@/lib/data-health";

/**
 * GET /api/v1/data-health
 *
 * Per-metric freshness from warmed Redis envelopes and the gas Blob release.
 * `stale` uses stale_grace when a metric has one. NTS intraday is stale after 3
 * hours. A completed gas day is not stale. The body still reports publication_lag.
 * published_at is the source time on the row. retrieved_at is when Grid stored
 * the envelope or the gas release. No Tinybird query.
 */
const DATA_HEALTH_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";

const ALLOWED = new Set(["scope", "geography"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = scopeRejection(params);
  if (scope) {
    return NextResponse.json(scope.body, { status: scope.status });
  }
  const extra = unsupportedFilter(params, ALLOWED);
  if (extra) {
    return NextResponse.json(extra.body, { status: extra.status });
  }
  const now = new Date();
  let readings;
  try {
    readings = await loadDataHealth(now);
  } catch {
    return NextResponse.json({ error: API_ERROR_SOURCE_UNAVAILABLE }, { status: 503 });
  }
  return NextResponse.json(
    {
      checkedAt: now.toISOString(),
      readings,
    },
    { headers: cdnCacheHeaders(DATA_HEALTH_CACHE_CONTROL) }
  );
}
