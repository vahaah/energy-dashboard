import { NextResponse } from "next/server";
import { cdnCacheHeaders } from "@/lib/api-route";
import { filterCanonicalCommodityPrices } from "@/lib/commodity-series";
import {
  getHeadlineGenerationQueryParams,
  getHeadlineSnapshotsQueryParams,
  getPricesQueryParams,
} from "@/lib/dashboard-data";
import {
  healthHttpStatus,
  latestObservedTimestamp,
  olderEmbeddedTimestamp,
  STALE_AFTER_MS,
  streamFreshness,
} from "@/lib/health";
import { healthMetrics, loadDataHealth, type HealthMetric } from "@/lib/data-health";
import type { CommodityPrice, EnergySnapshot, Generation5min } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

/**
 * GET /api/health
 *
 * Cheap freshness probe. Reads warmed envelopes only: 24h snapshots, 24h
 * generation (FUELINST and embedded), and 30d prices. A missing snapshot
 * envelope is a stale critical stream. Generation, embedded, and prices
 * stay non-critical. No Tinybird query. CDN only: 300s, matching homepage ISR.
 */
const HEALTH_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";

function priceObservedAt(date: string | null | undefined): string | null {
  if (!date) {
    return null;
  }
  if (date.includes(" ") || date.includes("T")) {
    return date;
  }
  return `${date.slice(0, 10)} 00:00:00`;
}

export async function GET() {
  const now = new Date();

  try {
    const [snapshots, generation, prices] = await Promise.all([
      peekWarmedPipe<EnergySnapshot>("snapshots_range", getHeadlineSnapshotsQueryParams(now), {
        range: "24h",
        now,
      }),
      peekWarmedPipe<Generation5min>("generation_5min_range", getHeadlineGenerationQueryParams(now), {
        range: "24h",
        now,
      }),
      peekWarmedPipe<CommodityPrice>("prices_range", getPricesQueryParams("30d", now), {
        range: "30d",
        now,
      }),
    ]);

    const generationRows = generation ?? [];
    const latestSnapshot = latestObservedTimestamp(
      (snapshots ?? []).map((row) => row.timestamp),
      now
    );
    const fuelinstLatest = latestObservedTimestamp(
      generationRows.filter((row) => row.source === "fuelinst").map((row) => row.timestamp),
      now
    );
    const embeddedWindLatest = latestObservedTimestamp(
      generationRows.filter((row) => row.fuel_type === "embedded_wind").map((row) => row.timestamp),
      now
    );
    const embeddedSolarLatest = latestObservedTimestamp(
      generationRows.filter((row) => row.fuel_type === "embedded_solar").map((row) => row.timestamp),
      now
    );
    const embeddedLatest = olderEmbeddedTimestamp(embeddedWindLatest, embeddedSolarLatest);
    const priceLatest = latestObservedTimestamp(
      filterCanonicalCommodityPrices(prices ?? [])
        .map((row) => priceObservedAt(row.date))
        .filter((value): value is string => value != null),
      now
    );

    const streams = [
      streamFreshness("snapshots", latestSnapshot, now, STALE_AFTER_MS.snapshots, true),
      streamFreshness("generation", fuelinstLatest, now, STALE_AFTER_MS.generation, false),
      streamFreshness("embedded", embeddedLatest, now, STALE_AFTER_MS.embedded, false),
      streamFreshness("prices", priceLatest, now, STALE_AFTER_MS.prices, false),
    ];

    let metrics: HealthMetric[] | undefined;
    try {
      metrics = healthMetrics(await loadDataHealth(now));
    } catch {
      metrics = undefined;
    }

    const status = healthHttpStatus(streams);
    return NextResponse.json(
      {
        ok: status === 200,
        checkedAt: now.toISOString(),
        streams,
        ...(metrics ? { metrics } : {}),
      },
      {
        status,
        headers: cdnCacheHeaders(HEALTH_CACHE_CONTROL),
      }
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
