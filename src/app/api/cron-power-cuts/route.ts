import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { publishSnapshot, readLatestSnapshot } from "@/lib/power-cuts/blob";
import { fetchAllSources, mergeSnapshot, powerCutsFlags } from "@/lib/power-cuts/collect";
import { revalidatePowerCuts } from "@/lib/power-cuts/revalidate";
import { isCronAuthorized } from "@/lib/cron-auth";
import { publicJobError, recordJobFailure, recordJobSuccess } from "@/lib/job-health";

/**
 * GET /api/cron-power-cuts
 *
 * Every 15 minutes. Fetches the operator feeds in this route. No Tinybird query.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const preferredRegion = "lhr1";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "BLOB_READ_WRITE_TOKEN is not set" }, { status: 503 });
  }
  const now = new Date();
  try {
    const previous = await readLatestSnapshot().catch(() => null);
    const fetched = await fetchAllSources(powerCutsFlags(), now);
    const snapshot = mergeSnapshot(fetched, previous, now);
    await publishSnapshot(snapshot, now);
    revalidatePowerCuts();
    await recordJobSuccess("cron-power-cuts", now);
    console.info("[cron-power-cuts] published", {
      fetchedAt: snapshot.fetchedAt,
      counts: Object.fromEntries(Object.entries(snapshot.sources).map(([operator, report]) => [operator, report.count])),
    });
    return NextResponse.json({
      ok: true,
      fetchedAt: snapshot.fetchedAt,
      sources: snapshot.sources,
    });
  } catch (error) {
    const message = publicJobError(error instanceof Error ? error.message : "power cuts publish failed");
    await recordJobFailure("cron-power-cuts", message, now);
    console.error("[cron-power-cuts] failed", { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
