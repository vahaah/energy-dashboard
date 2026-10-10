import type { NextRequest } from "next/server";
import { parseDashboardPeriod, parseOptionalDate } from "@/lib/api-params";
import { badRequest, cachedJson, upstreamError } from "@/lib/api-route";
import {
  dashboardPayloadPolicy,
  loadDashboardPayloadResult,
} from "@/lib/dashboard-payload";
import { GRID_CACHE_HEADER, type GridCacheStatus } from "@/lib/redis-cache";
import { payloadJsonBytes } from "@/lib/dashboard-payload-model";

/**
 * GET /api/dashboard?period=day|week|year|all&date=YYYY-MM-DD
 *
 * Assembled homepage payload for client-side range switching.
 * commodityRange is ignored: oil/gas prices live on /api/prices.
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

  const now = new Date();
  const policy = dashboardPayloadPolicy(periodResult.value);

  try {
    const { data, status, reason } = await loadDashboardPayloadResult({
      period: periodResult.value,
      date: dateResult.value,
      now,
    });
    logDashboardCache(status, periodResult.value, dateResult.value, payloadJsonBytes(data), reason);
    return cachedJson(data, policy, { [GRID_CACHE_HEADER]: status });
  } catch (error) {
    return upstreamError(error);
  }
}

function logDashboardCache(
  status: GridCacheStatus,
  period: string,
  date: string | null,
  bytes: number,
  reason?: string
): void {
  if (status === "fallback") {
    console.info(
      `[dashboard] cache=${status} period=${period} date=${date ?? "latest"} bytes=${bytes} reason=${reason ?? "unknown"}`
    );
    return;
  }
  console.info(
    `[dashboard] cache=${status} period=${period} date=${date ?? "latest"} bytes=${bytes}`
  );
}
