import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { tecSlot } from "@/lib/workflow-slot";
import { tecRegister } from "@/workflows/tec";

/**
 * GET /api/cron-tec
 *
 * Monday and Thursday at 06:15 UTC.
 * This route does not fetch NESO.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const run = await start(tecRegister, [tecSlot(now), crypto.randomUUID(), now.toISOString()]);
  console.info("[cron-tec] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
