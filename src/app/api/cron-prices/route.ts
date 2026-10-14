import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { unauthorized } from "@/lib/api-route";
import { isCronAuthorized } from "@/lib/cron-auth";
import { pricesSlot } from "@/lib/workflow-slot";
import { pricesSlot as pricesWorkflow } from "@/workflows/prices";

/**
 * GET /api/cron-prices
 *
 * Pro cron at minute 30 of every sixth hour. Starts the prices workflow. EIA, Pink Sheet, SAP,
 * one Events post, and the nine long pipes run inside steps.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const run = await start(pricesWorkflow, [pricesSlot(now), crypto.randomUUID(), now.toISOString()]);
  console.info("[cron-prices] started", { runId: run.runId });
  return NextResponse.json({ ok: true, runId: run.runId }, { status: 202 });
}
