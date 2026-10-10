import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { invalidateAndWarm } from "@/lib/cache-warm";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sourceStatusesHaveFailure, type SourceStatus } from "@/lib/http";
import { collectGenerationForSettlementDate } from "@/lib/ingest/collect-generation";
import { collectSnapshotsForSettlementDate } from "@/lib/ingest/collect-grid";
import { formatTinybirdDateTime, yesterdayLondonDate } from "@/lib/london-time";
import { ingestRows } from "@/lib/tinybird";

/**
 * GET /api/cron-yesterday
 *
 * Daily Vercel Cron (`30 9 * * *` UTC in vercel.json). Re-collects
 * yesterday's UK settlement date for energy_snapshots and generation_5min
 * so outages longer than the hourly look-back do not leave permanent holes.
 * 09:30 UTC is after the full 6h Elexon publish lag for both GMT (day ends
 * 00:00 UTC) and BST (day ends 23:00 UTC), so a truncated first pass is not
 * needed. ReplacingMergeTree keys make the rewrite idempotent.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const settlementDate = yesterdayLondonDate(now);
  const [snapshots, generation] = await Promise.all([
    collectSnapshotsForSettlementDate(settlementDate, now),
    collectGenerationForSettlementDate(settlementDate, now),
  ]);

  const sources: SourceStatus[] = [...snapshots.sources, ...generation.sources];

  if (snapshots.rows.length > 0) {
    try {
      await ingestRows("energy_snapshots", snapshots.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[cron-yesterday] snapshot ingest failed", message);
      sources.push({ source: "snapshots", ok: false, error: message });
    }
  }

  if (generation.rows.length > 0) {
    try {
      await ingestRows("generation_5min", generation.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[cron-yesterday] generation ingest failed", message);
      sources.push({ source: "generation", ok: false, error: message });
    }
  }

  const ingested = sources.some((source) => source.ok && (source.rows ?? 0) > 0);
  if (ingested) {
    await invalidateAndWarm(now, { historical: true });
  }

  const failed = sourceStatusesHaveFailure(sources);
  const timestamp = formatTinybirdDateTime(now);

  if (failed) {
    console.error("[cron-yesterday] one or more sources failed", {
      timestamp,
      settlementDate,
      sources,
    });
  } else {
    console.info("[cron-yesterday] completed", { timestamp, settlementDate, sources });
  }

  return NextResponse.json(
    {
      ok: !failed,
      timestamp,
      settlementDate,
      sources,
    },
    { status: failed ? 503 : 200 }
  );
}
