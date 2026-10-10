import type { NextRequest } from "next/server";
import { parseCommodityRange, parseDashboardPeriod, parseOptionalDate } from "@/lib/api-params";
import { badRequest, cachedJson, upstreamError } from "@/lib/api-route";
import {
  dashboardPayloadPolicy,
  loadDashboardPayload,
} from "@/lib/dashboard-payload";

/**
 * GET /api/dashboard?period=day|week|year|all&date=YYYY-MM-DD&commodityRange=30d|90d|1y
 *
 * Assembled homepage payload for client-side range switching.
 */
export async function GET(request: NextRequest) {
  const periodResult = parseDashboardPeriod(request.nextUrl.searchParams.get("period"));
  if (!periodResult.ok) {
    return badRequest(periodResult.error);
  }

  const dateResult = parseOptionalDate(request.nextUrl.searchParams.get("date"));
  if (!dateResult.ok) {
    return badRequest(dateResult.error);
  }

  const commodityResult = parseCommodityRange(
    request.nextUrl.searchParams.get("commodityRange"),
    "90d"
  );
  if (!commodityResult.ok) {
    return badRequest(commodityResult.error);
  }

  const now = new Date();
  const policy = dashboardPayloadPolicy(periodResult.value);

  try {
    const data = await loadDashboardPayload({
      period: periodResult.value,
      date: dateResult.value,
      commodityRange: commodityResult.value,
      now,
    });
    return cachedJson(data, policy);
  } catch (error) {
    return upstreamError(error);
  }
}
