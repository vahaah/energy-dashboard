import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseCommodityRange } from "@/lib/api-params";
import { badRequest, upstreamError } from "@/lib/api-route";
import { filterCanonicalCommodityPrices } from "@/lib/commodity-series";
import { getPricesQueryParams } from "@/lib/dashboard-data";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice } from "@/lib/types";

/**
 * GET /api/prices?range=30d|90d|1y&commodity=brent_crude|wti_crude|henry_hub_gas|eu_ttf|eu_natural_gas|lng_asia
 *
 * Public API — returns commodity price history.
 * `eu_ttf` is OilPriceAPI Dutch TTF in EUR/MWh.
 * `eu_natural_gas` is FRED monthly TTF in USD/MMBtu. Do not mix the two.
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const rangeResult = parseCommodityRange(request.nextUrl.searchParams.get("range"));
  if (!rangeResult.ok) {
    return badRequest(rangeResult.error);
  }

  const commodity = request.nextUrl.searchParams.get("commodity");
  const params = getPricesQueryParams(rangeResult.value);
  if (commodity) {
    params.commodity = commodity;
  }

  try {
    const data = filterCanonicalCommodityPrices(
      await queryPipe<CommodityPrice>("prices_range", params)
    );
    return NextResponse.json({ data, range: rangeResult.value, count: data.length });
  } catch (error) {
    return upstreamError(error);
  }
}
