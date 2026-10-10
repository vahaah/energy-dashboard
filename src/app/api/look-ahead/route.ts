import { NextResponse } from "next/server";
import { cdnCacheHeaders } from "@/lib/api-route";
import { forecastCacheControl, getLookAhead, publicLookAhead } from "@/lib/forecasts";

/**
 * GET /api/look-ahead
 *
 * Public API — Grid’s derived look-ahead only.
 * Returns the cleanest 2-hour window from the NESO Carbon Intensity 48h
 * forecast and a WINDFOR tonight/tomorrow sentence. Does not pass through
 * the raw carbon forecast series (Carbon Intensity API terms).
 */
export async function GET() {
  const view = await getLookAhead().catch(() => null);
  if (!view) {
    return NextResponse.json(
      publicLookAhead({
        fetchedAt: new Date().toISOString(),
        greenest: null,
        carbonSeries: [],
        wind: null,
        demandSeries: [],
      }),
      { headers: cdnCacheHeaders(forecastCacheControl()) }
    );
  }

  return NextResponse.json(publicLookAhead(view), {
    headers: cdnCacheHeaders(forecastCacheControl()),
  });
}
