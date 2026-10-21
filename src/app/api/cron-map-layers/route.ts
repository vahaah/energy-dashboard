import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { recordJobFailure, recordJobSuccess } from "@/lib/job-health";
import { runDnoLayerWatch } from "@/lib/map/layer-watch";

/**
 * GET /api/cron-map-layers
 *
 * Daily NESO DNO hash check. ETag when it matches, sha256 only when it does
 * not. A failure does not replace the pointer. No Tinybird calls.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }
  const result = await runDnoLayerWatch();
  if (result.ok) {
    await recordJobSuccess("cron-map-layers");
  } else {
    await recordJobFailure("cron-map-layers", result.error ?? "map layer watch failed");
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
