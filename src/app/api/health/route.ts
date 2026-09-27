import { NextResponse } from "next/server";
import {
  healthHttpStatus,
  latestObservedTimestamp,
  STALE_AFTER_MS,
  streamFreshness,
} from "@/lib/health";
import { filterCanonicalCommodityPrices } from "@/lib/commodity-series";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice, EnergySnapshot, Generation5min } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Lightweight freshness check for uptime monitors.
 * Returns 503 when a critical grid stream (snapshots or FUELINST) is stale.
 * Stale windows match ingest cadence: hourly cron + 90m margin.
 */
export async function GET() {
  const now = new Date();

  try {
    const [snapshots, generation, prices] = await Promise.all([
      queryPipe<EnergySnapshot>("latest_snapshot"),
      queryPipe<Generation5min>("latest_generation"),
      queryPipe<CommodityPrice>("latest_prices"),
    ]);

    const latestSnapshot = latestObservedTimestamp(
      snapshots.map((row) => row.timestamp),
      now
    );
    const fuelinstLatest = latestObservedTimestamp(
      generation.filter((row) => row.source === "fuelinst").map((row) => row.timestamp),
      now
    );
    const embeddedLatest = latestObservedTimestamp(
      generation
        .filter(
          (row) =>
            row.fuel_type === "embedded_solar" || row.fuel_type === "embedded_wind"
        )
        .map((row) => row.timestamp),
      now
    );
    const priceLatest = latestObservedTimestamp(
      filterCanonicalCommodityPrices(prices).map((row) => `${row.date} 00:00:00`),
      now
    );

    const streams = [
      streamFreshness("snapshots", latestSnapshot, now, STALE_AFTER_MS.snapshots, true),
      streamFreshness("generation", fuelinstLatest, now, STALE_AFTER_MS.generation, true),
      streamFreshness("embedded", embeddedLatest, now, STALE_AFTER_MS.embedded, false),
      streamFreshness("prices", priceLatest, now, STALE_AFTER_MS.prices, false),
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
