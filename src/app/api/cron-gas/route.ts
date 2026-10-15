import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { gasSlot } from "@/lib/workflow-slot";
import { gasIntraday } from "@/workflows/gas-intraday";

/**
 * GET /api/cron-gas
 *
 * Hourly at minute 5. Starts the intraday gas workflow. This route does not
 * fetch National Gas.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const run = await start(gasIntraday, [gasSlot(now), crypto.randomUUID(), now.toISOString()]);
  console.info("[cron-gas] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
