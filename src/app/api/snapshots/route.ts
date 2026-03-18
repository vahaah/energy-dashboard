import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryPipe } from "@/lib/tinybird";
import type { EnergySnapshot, TimeRange } from "@/lib/types";
import { getSnapshotsQueryParams } from "@/lib/dashboard-data";

/**
 * GET /api/snapshots?range=24h|7d|30d|90d|1y&date=YYYY-MM-DD
 *
 * Public API — returns energy snapshots for the given time range.
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const range = (request.nextUrl.searchParams.get("range") ?? "24h") as TimeRange;
  const date = request.nextUrl.searchParams.get("date");
  const params = getSnapshotsQueryParams(range, new Date(), date);

  const data = await queryPipe<EnergySnapshot>("snapshots_range", params);

  return NextResponse.json({ data, range, date, count: data.length });
}
