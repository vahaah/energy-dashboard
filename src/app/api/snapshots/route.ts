import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { queryPipe } from "@/lib/tinybird";
import type { EnergySnapshot } from "@/lib/types";

/**
 * GET /api/snapshots?range=24h|7d|30d|90d
 *
 * Public API — returns energy snapshots for the given time range.
 * Rate limited via middleware (60 req/min per IP).
 */
export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "24h";

  const now = new Date();
  let start: Date;
  let granularity: string | undefined;

  switch (range) {
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      granularity = "day";
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      granularity = "day";
      break;
    default: // 24h
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
  }

  const params: Record<string, string> = {
    start: start.toISOString().replace("T", " ").slice(0, 19),
    end: now.toISOString().replace("T", " ").slice(0, 19),
  };
  if (granularity) params.granularity = granularity;

  const data = await queryPipe<EnergySnapshot>("snapshots_range", params);

  return NextResponse.json({ data, range, count: data.length });
}
