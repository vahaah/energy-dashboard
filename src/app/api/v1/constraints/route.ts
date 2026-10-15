import { NextResponse } from "next/server";
import { constraintsQueryResponse } from "@/lib/constraints/query";

/**
 * GET /api/v1/constraints?from=&to=&boundary=
 *
 * Published constraint activity. Only the breakdowns the source publishes.
 * Settlement dates are inclusive. No Tinybird query.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await constraintsQueryResponse(new URL(request.url).searchParams);
  return NextResponse.json(result.body, { status: result.status });
}
