import type { NextRequest } from "next/server";
import { parseCommodityRange } from "@/lib/api-params";
import { badRequest, cachedJson, upstreamError } from "@/lib/api-route";
import { filterPublicCommodityPrices, isPublicCommodity } from "@/lib/commodity-series";
import { getPricesQueryParams } from "@/lib/dashboard-data";
import { getTinybirdCachePolicy } from "@/lib/tinybird-cache";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice } from "@/lib/types";

/**
 * GET /api/prices?range=30d|90d|1y&commodity=brent_crude|wti_crude|henry_hub_gas|eu_natural_gas|lng_asia|gb_gas_sap
 *
 * Public API — returns commodity price history.
 * EIA daily: Brent, WTI, Henry Hub. World Bank monthly: EU gas, Japan LNG.
 * `gb_gas_sap` is National Gas System Average Price in p/kWh (GBP).
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const rangeResult = parseCommodityRange(request.nextUrl.searchParams.get("range"));
  if (!rangeResult.ok) {
    return badRequest(rangeResult.error);
  }

  const commodity = request.nextUrl.searchParams.get("commodity");
  if (commodity && !isPublicCommodity(commodity)) {
    return badRequest("unknown commodity");
  }

  const now = new Date();
  const params = getPricesQueryParams(rangeResult.value, now);
  const cacheOptions = { range: rangeResult.value, now };
  const policy = getTinybirdCachePolicy({
    pipeName: "prices_range",
    params,
    ...cacheOptions,
  });

  try {
    const warmed = filterPublicCommodityPrices(
      await queryPipe<CommodityPrice>("prices_range", params, cacheOptions)
    );
    const data = commodity ? warmed.filter((row) => row.commodity === commodity) : warmed;
    return cachedJson({ data, range: rangeResult.value, count: data.length }, policy);
  } catch (error) {
    return upstreamError(error);
  }
}
