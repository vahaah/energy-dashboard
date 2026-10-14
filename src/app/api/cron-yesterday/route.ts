import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { yesterdaySlot } from "@/lib/workflow-slot";
import { yesterdayHeal } from "@/workflows/yesterday";

/**
 * GET /api/cron-yesterday
 *
 * Pro cron `30 9 * * *`. Starts the settlement-date heal. The route does
 * not collect or ingest.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const run = await start(yesterdayHeal, [yesterdaySlot(now), crypto.randomUUID(), now.toISOString()]);
  console.info("[cron-yesterday] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
