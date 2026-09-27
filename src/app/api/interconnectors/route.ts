import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseInterconnectorRange, parseOptionalDate } from "@/lib/api-params";
import { badRequest, upstreamError } from "@/lib/api-route";
import { getInterconnectorQueryParams } from "@/lib/dashboard-data";
import { queryPipe } from "@/lib/tinybird";
import type { InterconnectorFlow } from "@/lib/types";

/**
 * GET /api/interconnectors?range=24h|7d&date=YYYY-MM-DD
 *
 * Public API — returns interconnector flow data (imports/exports).
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const rangeResult = parseInterconnectorRange(request.nextUrl.searchParams.get("range"));
  if (!rangeResult.ok) {
    return badRequest(rangeResult.error);
  }

  const dateResult = parseOptionalDate(request.nextUrl.searchParams.get("date"));
  if (!dateResult.ok) {
    return badRequest(dateResult.error);
  }

  try {
    const data = await queryPipe<InterconnectorFlow>(
      "interconnector_flows",
      getInterconnectorQueryParams(rangeResult.value, new Date(), dateResult.value)
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
