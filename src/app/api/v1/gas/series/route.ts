import { NextResponse } from "next/server";
import { scopeRejection, unsupportedFilter } from "@/lib/api/errors";
import { gasSeriesResponse } from "@/lib/gas/query";

/**
 * GET /api/v1/gas/series?metric=&from=&to=
 *
 * Reads the Blob series file. Each point has a UTC timestamp and a gas-day label.
 * An unknown metric is 400. No Tinybird query.
 */
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["metric", "from", "to", "scope", "geography"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = scopeRejection(params);
  if (scope) {
    return NextResponse.json(scope.body, { status: scope.status });
  }
  const extra = unsupportedFilter(params, ALLOWED);
  if (extra) {
    return NextResponse.json(extra.body, { status: extra.status });
  }
  const result = await gasSeriesResponse(params.get("metric"), params.get("from"), params.get("to"));
  return NextResponse.json(result.body, { status: result.status });
}