import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { halfHourSlot } from "@/lib/workflow-slot";
import { electricitySlot } from "@/workflows/electricity";

/**
 * GET /api/cron-warm
 *
 * Same half-hour electricity workflow as /api/cron. A double fire loses the
 * slot lock before any upstream or Tinybird call and the run ends as a skip.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const run = await start(electricitySlot, [halfHourSlot(now), crypto.randomUUID(), now.toISOString(), "cron-warm"]);
  console.info("[cron-warm] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
