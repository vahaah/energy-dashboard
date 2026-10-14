import type { NextRequest } from "next/server";
import { parseOptionalDate, parseTimeRange } from "@/lib/api-params";
import { badRequest, cachedJson, upstreamError } from "@/lib/api-route";
import { getGenerationQueryParams } from "@/lib/dashboard-data";
import { getTinybirdCachePolicy } from "@/lib/tinybird-cache";
import { queryPipe } from "@/lib/tinybird";
import type { Generation5min } from "@/lib/types";
import { getLondonDate } from "@/lib/london-time";
import { sliceLondonDay, futureDateError } from "@/lib/warm-window";

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
  const dateError = futureDateError(dateResult.value, now);
  if (dateError) {
    return badRequest(dateError);
  }

  const pastDate =
    dateResult.value && dateResult.value !== getLondonDate(now) ? dateResult.value : null;
  const params = getGenerationQueryParams(rangeResult.value, now);
  const cacheOptions = {
    range: rangeResult.value,
    now,
    ...(pastDate ? { date: pastDate } : {}),
  };
  const policy = getTinybirdCachePolicy({
    pipeName: "generation_5min_range",
    params,
    ...cacheOptions,
  });

  try {
    const rows = await queryPipe<Generation5min>("generation_5min_range", params, cacheOptions);
    const data = sliceLondonDay(rows, dateResult.value, now);
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
