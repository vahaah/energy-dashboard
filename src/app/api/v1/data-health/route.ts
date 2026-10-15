import { NextResponse } from "next/server";
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

export async function GET() {
  const now = new Date();
  const readings = await loadDataHealth(now);
  return NextResponse.json(
    {
      checkedAt: now.toISOString(),
      readings,
    },
    { headers: cdnCacheHeaders(DATA_HEALTH_CACHE_CONTROL) }
  );
}
