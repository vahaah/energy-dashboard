import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sourceStatusesHaveFailure, type SourceStatus } from "@/lib/http";
import { collectGenerationForSettlementDate } from "@/lib/ingest/collect-generation";
import { collectSnapshotsForSettlementDate } from "@/lib/ingest/collect-grid";
import { formatTinybirdDateTime, yesterdayLondonDate } from "@/lib/london-time";
import { ingestRows } from "@/lib/tinybird";

/**
 * GET /api/cron-yesterday
 *
 * Daily Vercel Cron. Re-collects yesterday's UK settlement date for
 * energy_snapshots and generation_5min so outages longer than the hourly
 * look-back do not leave permanent holes. ReplacingMergeTree keys make
 * the rewrite idempotent.
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
    collectSnapshotsForSettlementDate(settlementDate),
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
    revalidateTag(DASHBOARD_CACHE_TAG, "max");
    revalidatePath("/");
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
