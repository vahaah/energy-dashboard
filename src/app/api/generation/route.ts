import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseOptionalDate, parseTimeRange } from "@/lib/api-params";
import { badRequest, upstreamError } from "@/lib/api-route";
import { getGenerationQueryParams } from "@/lib/dashboard-data";
import { queryPipe } from "@/lib/tinybird";
import type { Generation5min } from "@/lib/types";

/**
 * GET /api/generation?range=24h|7d|30d|90d|1y&date=YYYY-MM-DD
 *
 * Public API — FUELINST, NESO embedded wind, and Sheffield Solar PV Live.
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const rangeResult = parseTimeRange(request.nextUrl.searchParams.get("range"));
  if (!rangeResult.ok) {
    return badRequest(rangeResult.error);
  }

  const dateResult = parseOptionalDate(request.nextUrl.searchParams.get("date"));
  if (!dateResult.ok) {
    return badRequest(dateResult.error);
  }

  try {
    const data = await queryPipe<Generation5min>(
      "generation_5min_range",
      getGenerationQueryParams(rangeResult.value, new Date(), dateResult.value)
    );
    return NextResponse.json({
      data,
      range: rangeResult.value,
      date: dateResult.value,
      count: data.length,
    });
  } catch (error) {
    return upstreamError(error);
  }
}
