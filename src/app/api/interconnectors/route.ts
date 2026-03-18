import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryPipe } from "@/lib/tinybird";
import type { InterconnectorFlow } from "@/lib/types";

/**
 * GET /api/interconnectors?range=24h|7d
 *
 * Public API — returns interconnector flow data (imports/exports).
 * Rate limited via middleware (60 req/min per IP).
 */

export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "24h";

  const now = new Date();
  let start: Date;

  switch (range) {
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default: // 24h
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
  }

  const data = await queryPipe<InterconnectorFlow>("interconnector_flows", {
    start: start.toISOString().replace("T", " ").slice(0, 19),
    end: now.toISOString().replace("T", " ").slice(0, 19),
  });

  return NextResponse.json({ data, range, count: data.length });
}
