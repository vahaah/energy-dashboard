import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isConstraintsBundle } from "@/lib/constraints/release";
import { constraintsSlot } from "@/lib/workflow-slot";
import { nesoConstraints } from "@/workflows/constraints";

/**
 * GET /api/cron-constraints?bundle=breakdown|day-ahead
 *
 * Breakdown at 04:40 UTC. Day-ahead at 16:40 UTC on weekdays.
 * This route does not fetch NESO.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const bundle = new URL(request.url).searchParams.get("bundle") ?? "";
  if (!isConstraintsBundle(bundle)) {
    return NextResponse.json({ error: "unsupported filter" }, { status: 400 });
  }

  const now = new Date();
  const run = await start(nesoConstraints, [constraintsSlot(now, bundle), crypto.randomUUID(), now.toISOString(), bundle]);
  console.info("[cron-constraints] started", { runId: run.runId, bundle });
  return NextResponse.json({ ok: true, runId: run.runId, bundle }, { status: 202 });
}
