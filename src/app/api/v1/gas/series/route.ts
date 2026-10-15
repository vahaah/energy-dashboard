import { NextResponse } from "next/server";
import { gasSeriesResponse } from "@/lib/gas/query";

/**
 * GET /api/v1/gas/series?metric=&from=&to=
 *
 * Reads the Blob series file. Each point has a UTC timestamp and a gas-day label.
 * An unknown metric is 400. No Tinybird query.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const result = await gasSeriesResponse(params.get("metric"), params.get("from"), params.get("to"));
  return NextResponse.json(result.body, { status: result.status });
}