import { NextResponse } from "next/server";
import { gasOverviewResponse } from "@/lib/gas/query";

/**
 * GET /api/v1/gas/overview?gas_day=
 *
 * Reads the Blob release. Timestamps are UTC. gas_day is the London gas-day label.
 * No Tinybird query.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gasDay = new URL(request.url).searchParams.get("gas_day");
  const result = await gasOverviewResponse(gasDay);
  return NextResponse.json(result.body, { status: result.status });
}
