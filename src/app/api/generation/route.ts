import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryPipe } from "@/lib/tinybird";
import type { Generation5min, TimeRange } from "@/lib/types";
import { getGenerationQueryParams } from "@/lib/dashboard-data";

/**
 * GET /api/generation?range=24h|7d|30d|90d|1y&date=YYYY-MM-DD
 *
 * Public API — returns generation data from FUELINST + NESO.
 * Automatically aggregates to hourly/daily for larger ranges.
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const range = (request.nextUrl.searchParams.get("range") ?? "24h") as TimeRange;
  const date = request.nextUrl.searchParams.get("date");
  const params = getGenerationQueryParams(range, new Date(), date);

  const data = await queryPipe<Generation5min>("generation_5min_range", params);

  return NextResponse.json({ data, range, date, count: data.length });
}
