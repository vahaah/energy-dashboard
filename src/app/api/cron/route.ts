import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { halfHourSlot } from "@/lib/workflow-slot";
import { electricitySlot } from "@/workflows/electricity";

/**
 * GET /api/cron
 *
 * Pro cron, every 30 minutes. Authenticates and starts the electricity workflow.
 * On the hour the run ingests; every slot warms the six live pipes.
 * Half-hour slots are warm-only. The route does not fetch upstream.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const run = await start(electricitySlot, [halfHourSlot(now), crypto.randomUUID(), now.toISOString()]);
  console.info("[cron] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
