import { NextResponse } from "next/server";
import {
  healthHttpStatus,
  latestObservedTimestamp,
  STALE_AFTER_MS,
  streamFreshness,
  unprobedStream,
} from "@/lib/health";
import {
  TinybirdLimitError,
  getTinybirdCachePolicy,
  tinybirdCacheControl,
} from "@/lib/tinybird-cache";
import { queryPipe } from "@/lib/tinybird";
import type { EnergySnapshot } from "@/lib/types";

/**
 * GET /api/health
 *
 * Cheap freshness probe for uptime monitors. One `latest_snapshot` pipe call,
 * cached 15 minutes. 503 when that critical grid snapshot is stale.
 * Generation / embedded / prices stay in the payload as non-critical
 * unprobed streams so existing monitors keep the same shape.
 */
export async function GET() {
  const now = new Date();
  const cacheOptions = { purpose: "health" as const, now };
  const policy = getTinybirdCachePolicy({
    pipeName: "latest_snapshot",
    ...cacheOptions,
  });

  try {
    const snapshots = await queryPipe<EnergySnapshot>(
      "latest_snapshot",
      undefined,
      cacheOptions
    );

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
        headers: { "Cache-Control": tinybirdCacheControl(policy) },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retryAfter =
      error instanceof TinybirdLimitError ? error.retryAfterSeconds : undefined;
    return NextResponse.json(
      {
        ok: false,
        checkedAt: now.toISOString(),
        error: message,
      },
      {
        status: 503,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
      }
    );
  }
}
