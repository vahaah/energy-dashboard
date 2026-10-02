import type { NextRequest } from "next/server";
import { parseOptionalDate, parseTimeRange } from "@/lib/api-params";
import { badRequest, cachedJson, upstreamError } from "@/lib/api-route";
import { getGenerationQueryParams } from "@/lib/dashboard-data";
import { getTinybirdCachePolicy } from "@/lib/tinybird-cache";
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

  const now = new Date();
  const params = getGenerationQueryParams(rangeResult.value, now, dateResult.value);
  const cacheOptions = { range: rangeResult.value, date: dateResult.value, now };
  const policy = getTinybirdCachePolicy({
    pipeName: "generation_5min_range",
    params,
    ...cacheOptions,
  });

  try {
    const data = await queryPipe<Generation5min>("generation_5min_range", params, cacheOptions);
    return cachedJson(
      {
        data,
        range: rangeResult.value,
        date: dateResult.value,
        count: data.length,
      },
      policy
    );
  } catch (error) {
    return upstreamError(error);
  }
}
