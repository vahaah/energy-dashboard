import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryPipe } from "@/lib/tinybird";
import type { InterconnectorFlow } from "@/lib/types";
import { getInterconnectorQueryParams } from "@/lib/dashboard-data";

/**
 * GET /api/interconnectors?range=24h|7d&date=YYYY-MM-DD
 *
 * Public API — returns interconnector flow data (imports/exports).
 * Rate limited via middleware (60 req/min per IP).
 */

export async function GET(request: NextRequest) {
  const range = (request.nextUrl.searchParams.get("range") ?? "24h") as "24h" | "7d";
  const date = request.nextUrl.searchParams.get("date");
  const data = await queryPipe<InterconnectorFlow>(
    "interconnector_flows",
    getInterconnectorQueryParams(range, new Date(), date)
  );

  return NextResponse.json({ data, range, date, count: data.length });
}
