import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice, CommodityRange } from "@/lib/types";
import { getPricesQueryParams } from "@/lib/dashboard-data";

/**
 * GET /api/prices?range=30d|90d|1y&commodity=brent_crude|wti_crude|henry_hub_gas
 *
 * Public API — returns commodity price history.
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const range = (request.nextUrl.searchParams.get("range") ?? "30d") as CommodityRange;
  const commodity = request.nextUrl.searchParams.get("commodity");
  const params = getPricesQueryParams(range);
  if (commodity) params.commodity = commodity;

  const data = await queryPipe<CommodityPrice>("prices_range", params);

  return NextResponse.json({ data, range, count: data.length });
}
