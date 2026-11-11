import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { balancingSlot } from "@/lib/workflow-slot";
import { balancingDaily } from "@/workflows/balancing";

/**
 * GET /api/cron-balancing
 *
 * 05:10 UTC. This route does not fetch NESO or Elexon.
 * Tinybird impact: 0.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }
  const now = new Date();
  const run = await start(balancingDaily, [balancingSlot(now), crypto.randomUUID(), now.toISOString()]);
  console.info("[cron-balancing] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
