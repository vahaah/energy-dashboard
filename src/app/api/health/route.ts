import { NextResponse } from "next/server";
import { cdnCacheHeaders } from "@/lib/api-route";
import { getHeadlineSnapshotsQueryParams } from "@/lib/dashboard-data";
import {
  healthHttpStatus,
  latestObservedTimestamp,
  STALE_AFTER_MS,
  streamFreshness,
  unprobedStream,
} from "@/lib/health";
import type { EnergySnapshot } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

/**
 * GET /api/health
 *
 * Cheap freshness probe. Reads the warmed 24h snapshots envelope. A missing
 * envelope is a stale critical stream, not a Tinybird query. Generation,
 * embedded, and prices stay unprobed so monitors keep the same shape.
 * CDN only: 300s, which matches the homepage ISR.
 */
const HEALTH_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";

export async function GET() {
  const now = new Date();

  try {
    const snapshots =
      (await peekWarmedPipe<EnergySnapshot>(
        "snapshots_range",
        getHeadlineSnapshotsQueryParams(now),
        { range: "24h", now }
      )) ?? [];

    const latestSnapshot = latestObservedTimestamp(
      snapshots.map((row) => row.timestamp),
      now
    );

    const streams = [
      streamFreshness("snapshots", latestSnapshot, now, STALE_AFTER_MS.snapshots, true),
      unprobedStream("generation", STALE_AFTER_MS.generation),
      unprobedStream("embedded", STALE_AFTER_MS.embedded),
      unprobedStream("prices", STALE_AFTER_MS.prices),
    ];

    const status = healthHttpStatus(streams);
    return NextResponse.json(
      {
        ok: status === 200,
        checkedAt: now.toISOString(),
        streams,
      },
      {
        status,
        headers: cdnCacheHeaders(HEALTH_CACHE_CONTROL),
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        checkedAt: now.toISOString(),
        error: message,
      },
      { status: 503 }
    );
  }
}
