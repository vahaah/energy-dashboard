import { NextResponse } from "next/server";
import { scopeRejection, unsupportedFilter } from "@/lib/api/errors";
import { gasOverviewResponse } from "@/lib/gas/query";

/**
 * GET /api/v1/gas/overview?gas_day=
 *
 * Reads the Blob release. Timestamps are UTC. gas_day is the London gas-day label.
 * No Tinybird query.
 */
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["gas_day", "scope", "geography"]);

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
  const result = await gasOverviewResponse(params.get("gas_day"));
  return NextResponse.json(result.body, { status: result.status });
}
