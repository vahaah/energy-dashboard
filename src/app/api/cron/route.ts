import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { invalidateAndWarm } from "@/lib/cache-warm";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sourceStatusesHaveFailure, type SourceStatus } from "@/lib/http";
import { collectRecentGeneration } from "@/lib/ingest/collect-generation";
import { collectRecentSnapshots } from "@/lib/ingest/collect-grid";
import { formatTinybirdDateTime } from "@/lib/london-time";
import { ingestRows } from "@/lib/tinybird";

/**
 * GET /api/cron
 *
 * Hourly Vercel Cron. Collects GB grid data only:
 *   1. Carbon Intensity + Elexon settlement periods → energy_snapshots
 *   2. FUELINST + NESO embedded wind + Sheffield PV Live → generation_5min
 *
 * Commodity prices live on /api/cron-prices so this job stays under the
 * function time limit. Generation sources ingest independently. Snapshot
 * sources must all succeed before a wide row is written.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const [snapshots, generation] = await Promise.all([
    collectRecentSnapshots(now),
    collectRecentGeneration(now),
  ]);

  const sources: SourceStatus[] = [...snapshots.sources, ...generation.sources];

  if (snapshots.rows.length > 0) {
    try {
      await ingestRows("energy_snapshots", snapshots.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[cron] snapshot ingest failed", message);
      sources.push({ source: "snapshots", ok: false, error: message });
    }
  }

  if (generation.rows.length > 0) {
    try {
      await ingestRows("generation_5min", generation.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[cron] generation ingest failed", message);
      sources.push({ source: "generation", ok: false, error: message });
    }
  }

  const ingested = sources.some((source) => source.ok && (source.rows ?? 0) > 0);
  if (ingested) {
    await invalidateAndWarm(now);
  }

  const failed = sourceStatusesHaveFailure(sources);
  const timestamp = formatTinybirdDateTime(now);

  if (failed) {
    console.error("[cron] one or more sources failed", { timestamp, sources });
  } else {
    console.info("[cron] completed", { timestamp, sources });
  }

  return NextResponse.json(
    {
      ok: !failed,
      timestamp,
      sources,
    },
    { status: failed ? 503 : 200 }
  );
}

