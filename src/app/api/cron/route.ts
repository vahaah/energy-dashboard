import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
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
 * function time limit. One failing source does not skip the others.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const sources = await Promise.all([
    runSource("snapshots", async () => {
      const rows = await collectRecentSnapshots(now);
      await ingestRows("energy_snapshots", rows);
      return rows.length;
    }),
    runSource("generation", async () => {
      const rows = await collectRecentGeneration(now);
      await ingestRows("generation_5min", rows);
      return rows.length;
    }),
  ]);

  const ingested = sources.some((source) => source.ok && (source.rows ?? 0) > 0);
  if (ingested) {
    revalidateTag(DASHBOARD_CACHE_TAG, "max");
    revalidatePath("/");
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

async function runSource(
  source: string,
  work: () => Promise<number>
): Promise<SourceStatus> {
  try {
    const rows = await work();
    return { source, ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron] ${source} failed`, message);
    return { source, ok: false, error: message };
  }
}
