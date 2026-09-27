import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
import { isCronAuthorized } from "@/lib/cron-auth";
import type { SourceStatus } from "@/lib/http";
import { fetchGbGasSapRange, sapCronWindow } from "@/lib/gb-gas-sap";
import {
  fetchEiaLatest,
  fetchFredLatest,
  fetchOilPriceLatest,
  isOilPriceTtfCronSlot,
  isRequiredPriceCronSource,
  latestCommodityDate,
  mergePriceRows,
  rejectCrossWiredPriceRows,
  shouldFetchOilPriceTtf,
  type PriceRow,
} from "@/lib/ingest/collect-prices";
import { formatIsoDate } from "@/lib/london-time";
import { ingestRows, queryPipe } from "@/lib/tinybird";
import type { CommodityPrice } from "@/lib/types";

/**
 * GET /api/cron-prices
 *
 * Every 6 hours. Fetches commodity prices from:
 *   1. EIA — Brent, WTI, Henry Hub ($/bbl and $/MMBtu)
 *   2. OilPriceAPI — Dutch TTF (EUR/MWh as eu_ttf), 00:30 UTC slot only
 *   3. FRED — monthly TTF + LNG in $/MMBtu (eu_natural_gas / lng_asia)
 *   4. National Gas — GB System Average Price (p/kWh as gb_gas_sap), last ~7 gas days
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const today = formatIsoDate(now);
  const utcHour = now.getUTCHours();
  const eiaKey = process.env.EIA_API_KEY;
  const oilApiKey = process.env.OIL_PRICE_API_KEY;
  const fredKey = process.env.FRED_API_KEY;

  const sapWindow = sapCronWindow(now);
  const [eia, oil, fred, sap] = await Promise.all([
    runOptionalSource("eia", eiaKey && eiaKey !== "DEMO_KEY" ? eiaKey : null, "EIA_API_KEY is not set (DEMO_KEY is not used)", (key) =>
      fetchEiaLatest(key)
    ),
    runOptionalSource("oilpriceapi", oilApiKey ?? null, "OIL_PRICE_API_KEY is not set; skipped", (key) =>
      fetchOilPriceTtfIfNeeded(key, today, utcHour)
    ),
    runOptionalSource("fred", fredKey ?? null, "FRED_API_KEY is not set; skipped", (key) => fetchFredLatest(key)),
    runKeylessSource("nationalgas", () => fetchGbGasSapRange(sapWindow.from, sapWindow.to)),
  ]);

  const oilRows = rejectCrossWiredPriceRows(oil.rowsData ?? []);
  const fredRows = rejectCrossWiredPriceRows(
    mergePriceRows(oilRows, fred.rowsData ?? []).filter(
      (row) => !oilRows.some((oilRow) => oilRow.commodity === row.commodity)
    )
  );

  const sapRows = rejectCrossWiredPriceRows(sap.rowsData ?? []);

  const ingestStatuses = await Promise.all([
    ingestSource("eia", eia, eia.rowsData ?? []),
    ingestSource("oilpriceapi", oil, oilRows),
    ingestSource("fred", fred, fredRows),
    ingestSource("nationalgas", sap, sapRows),
  ]);

  const ingested = ingestStatuses.some((source) => source.ok && (source.rows ?? 0) > 0);
  if (ingested) {
    revalidateTag(DASHBOARD_CACHE_TAG, "max");
    revalidatePath("/");
  }

  const hasHardFailure = ingestStatuses.some(
    (source) => !source.ok && isRequiredPriceCronSource(source.source)
  );

  if (hasHardFailure) {
    console.error("[cron-prices] required source failed", ingestStatuses);
  } else {
    console.info("[cron-prices] completed", ingestStatuses);
  }

  return NextResponse.json(
    {
      ok: !hasHardFailure,
      ingested: ingestStatuses.reduce((sum, source) => sum + (source.rows ?? 0), 0),
      sources: ingestStatuses,
    },
    { status: hasHardFailure ? 503 : 200 }
  );
}

async function fetchOilPriceTtfIfNeeded(
  apiKey: string,
  today: string,
  utcHour: number
): Promise<PriceRow[]> {
  if (!isOilPriceTtfCronSlot(utcHour)) {
    return [];
  }
  const latestTtfDate = latestCommodityDate(
    await queryPipe<CommodityPrice>("latest_prices"),
    "eu_ttf"
  );
  if (!shouldFetchOilPriceTtf(today, latestTtfDate, utcHour)) {
    return [];
  }
  return fetchOilPriceLatest(apiKey, today);
}

type FetchedSource = SourceStatus & { rowsData?: PriceRow[] };

async function runKeylessSource(
  source: string,
  fetchRows: () => Promise<PriceRow[]>
): Promise<FetchedSource> {
  try {
    const rowsData = await fetchRows();
    return { source, ok: true, rows: rowsData.length, rowsData };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron-prices] ${source} failed`, message);
    return { source, ok: false, error: message };
  }
}

async function runOptionalSource(
  source: string,
  key: string | null,
  skippedMessage: string,
  fetchRows: (key: string) => Promise<PriceRow[]>
): Promise<FetchedSource> {
  if (!key) {
    const required = isRequiredPriceCronSource(source);
    return {
      source,
      ok: !required,
      rows: 0,
      error: skippedMessage,
    };
  }

  try {
    const rowsData = await fetchRows(key);
    return { source, ok: true, rows: rowsData.length, rowsData };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron-prices] ${source} failed`, message);
    return { source, ok: false, error: message };
  }
}

async function ingestSource(
  source: string,
  fetched: FetchedSource,
  rows: PriceRow[]
): Promise<SourceStatus> {
  if (!fetched.ok) {
    return { source, ok: fetched.ok, rows: fetched.rows, error: fetched.error };
  }

  try {
    if (rows.length > 0) {
      await ingestRows("commodity_prices", rows);
    }
    return { source, ok: true, rows: rows.length, error: fetched.error };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron-prices] ${source} ingest failed`, message);
    return { source, ok: false, error: message };
  }
}
