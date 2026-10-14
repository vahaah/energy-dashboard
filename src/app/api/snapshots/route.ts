import type { NextRequest } from "next/server";
import { parseOptionalDate, parseTimeRange } from "@/lib/api-params";
import { badRequest, cachedJson, upstreamError } from "@/lib/api-route";
import { getSnapshotsQueryParams } from "@/lib/dashboard-data";
import { getTinybirdCachePolicy } from "@/lib/tinybird-cache";
import { queryPipe } from "@/lib/tinybird";
import { elexonBmrsAttributionBlock } from "@/lib/attribution";
import type { EnergySnapshot } from "@/lib/types";
import { sliceLondonDay, unwarmedDateError } from "@/lib/warm-window";

/**
 * GET /api/snapshots?range=24h|7d|30d|90d|1y&date=YYYY-MM-DD
 *
 * Public API — returns energy snapshots for the given time range.
 * `price_mid_gbp_mwh` is the short-term wholesale Market Index (APXMIDP).
 * `price_gbp_mwh` is the GB imbalance (cash-out / system buy) price.
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
  const dateError = unwarmedDateError(dateResult.value, rangeResult.value, now);
  if (dateError) {
    return badRequest(dateError);
  }

  const params = getSnapshotsQueryParams(rangeResult.value, now);
  const cacheOptions = { range: rangeResult.value, now };
  const policy = getTinybirdCachePolicy({
    pipeName: "snapshots_range",
    params,
    ...cacheOptions,
  });

  try {
    const rows = await queryPipe<EnergySnapshot>("snapshots_range", params, cacheOptions);
    const data = sliceLondonDay(rows, dateResult.value, now);
    return cachedJson(
      {
        data,
        range: rangeResult.value,
        date: dateResult.value,
        count: data.length,
        attribution: elexonBmrsAttributionBlock(),
      },
      policy
    );
  } catch (error) {
    return upstreamError(error);
  }
}
