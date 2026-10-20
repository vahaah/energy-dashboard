import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { eirgridSlot } from "@/lib/workflow-slot";
import { eirgridNi } from "@/workflows/eirgrid-ni";

/**
 * GET /api/cron-northern-ireland
 *
 * Hourly at minute 15. Starts the EirGrid workflow. This route does not fetch EirGrid.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";
// Project function regions are lhr1 and fra1. dub1 is not configured.
// workflow 4.8 shares one step function and cannot pin this collector alone.
export const preferredRegion = "lhr1";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const run = await start(eirgridNi, [eirgridSlot(now), crypto.randomUUID(), now.toISOString()]);
  console.info("[cron-northern-ireland] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
