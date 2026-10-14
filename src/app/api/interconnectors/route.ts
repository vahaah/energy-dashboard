import type { NextRequest } from "next/server";
import { parseInterconnectorRange, parseOptionalDate } from "@/lib/api-params";
import { badRequest, cachedJson, upstreamError } from "@/lib/api-route";
import { getInterconnectorQueryParams } from "@/lib/dashboard-data";
import { getTinybirdCachePolicy } from "@/lib/tinybird-cache";
import { queryPipe } from "@/lib/tinybird";
import type { InterconnectorFlow } from "@/lib/types";
import { getLondonDate } from "@/lib/london-time";
import { sliceLondonDay, futureDateError } from "@/lib/warm-window";

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

  const now = new Date();
  const dateError = futureDateError(dateResult.value, now);
  if (dateError) {
    return badRequest(dateError);
  }

  const pastDate =
    dateResult.value && dateResult.value !== getLondonDate(now) ? dateResult.value : null;
  const params = getInterconnectorQueryParams(rangeResult.value, now);
  const cacheOptions = {
    range: rangeResult.value,
    now,
    ...(pastDate ? { date: pastDate } : {}),
  };
  const policy = getTinybirdCachePolicy({
    pipeName: "interconnector_flows",
    params,
    ...cacheOptions,
  });

  try {
    const rows = await queryPipe<InterconnectorFlow>("interconnector_flows", params, cacheOptions);
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
