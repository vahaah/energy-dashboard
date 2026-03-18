import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice } from "@/lib/types";

/**
 * GET /api/prices?range=30d|90d|1y&commodity=brent_crude|wti_crude|henry_hub_gas
 *
 * Public API — returns commodity price history.
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "30d";
  const commodity = request.nextUrl.searchParams.get("commodity");

  const now = new Date();
  let start: Date;

  switch (range) {
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default: // 30d
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const params: Record<string, string> = {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
  if (commodity) params.commodity = commodity;

  const data = await queryPipe<CommodityPrice>("prices_range", params);

  return NextResponse.json({ data, range, count: data.length });
}
