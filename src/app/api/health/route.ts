import { NextResponse } from "next/server";
import { healthHttpStatus, STALE_AFTER_MS, streamFreshness } from "@/lib/health";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice, EnergySnapshot, Generation5min } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Lightweight freshness check for uptime monitors.
 * Returns 503 when a critical grid stream (snapshots or FUELINST) is stale.
 */
export async function GET() {
  const now = new Date();

  try {
    const [snapshots, generation, prices] = await Promise.all([
      queryPipe<EnergySnapshot>("latest_snapshot"),
      queryPipe<Generation5min>("latest_generation"),
      queryPipe<CommodityPrice>("latest_prices"),
    ]);

    const latestSnapshot = snapshots[0]?.timestamp ?? null;
    const fuelinstLatest = latestTimestamp(
      generation.filter((row) => row.source === "fuelinst")
    );
    const embeddedLatest = latestTimestamp(
      generation.filter(
        (row) =>
          row.fuel_type === "embedded_solar" || row.fuel_type === "embedded_wind"
      )
    );
    const priceLatest = prices.reduce<string | null>((latest, row) => {
      if (!latest || row.date > latest) {
        return row.date;
      }
      return latest;
    }, null);

    const streams = [
      streamFreshness("snapshots", latestSnapshot, now, STALE_AFTER_MS.snapshots, true),
      streamFreshness("generation", fuelinstLatest, now, STALE_AFTER_MS.generation, true),
      streamFreshness("embedded", embeddedLatest, now, STALE_AFTER_MS.embedded, false),
      streamFreshness(
        "prices",
        priceLatest ? `${priceLatest} 00:00:00` : null,
        now,
        STALE_AFTER_MS.prices,
        false
      ),
    ];

    return NextResponse.json(
      {
        ok: healthHttpStatus(streams) === 200,
        checkedAt: now.toISOString(),
        streams,
      },
      { status: healthHttpStatus(streams) }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        checkedAt: now.toISOString(),
        error: message,
      },
      { status: 503 }
    );
  }
}

function latestTimestamp(rows: Generation5min[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    if (!latest || row.timestamp > latest) {
      return row.timestamp;
    }
    return latest;
  }, null);
}
