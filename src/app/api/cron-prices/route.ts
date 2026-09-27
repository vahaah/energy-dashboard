import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-route";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
import { isCronAuthorized } from "@/lib/cron-auth";
import type { SourceStatus } from "@/lib/http";
import { fetchGbGasSapRange, sapCronWindow } from "@/lib/gb-gas-sap";
import {
  eiaApiKeyFromEnv,
  eiaCronWindow,
  fetchEiaRange,
  isRequiredPriceCronSource,
  rejectCrossWiredPriceRows,
  selectCronWorldBankRows,
  type PriceRow,
} from "@/lib/ingest/collect-prices";
import { ingestRows } from "@/lib/tinybird";
import { fetchWorldBankMonthly, worldBankCronWindow } from "@/lib/world-bank-pink-sheet";

/**
 * GET /api/cron-prices
 *
 * Every 6 hours. Fetches commodity prices from:
 *   1. EIA — Brent, WTI, Henry Hub. 00:30 UTC writes a 400-day window;
 *      other slots write the last 30 days. One v2 request per series.
 *   2. World Bank Pink Sheet — EU gas and Japan LNG monthly, from 2025-01
 *      on every run (one xlsx download). Month-start keys are always written
 *      so leftover FRED / OilPrice values are replaced (last-insert-wins + FINAL).
 *   3. National Gas — GB System Average Price (p/kWh as gb_gas_sap), last ~7 gas days
 * ReplacingMergeTree(date, commodity) makes the daily heal idempotent. After
 * deploy, the next 00:30 UTC slot backfills EIA history within 24h.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const now = new Date();
  const eiaKey = eiaApiKeyFromEnv(process.env.EIA_API_KEY);
  const eiaWindow = eiaCronWindow(now);
  const sapWindow = sapCronWindow(now);
  const pinkSheetWindow = worldBankCronWindow(now);

  const [eia, worldbank, sap] = await Promise.all([
    runOptionalSource("eia", eiaKey, "EIA_API_KEY is not set (DEMO_KEY is not used)", (key) =>
      fetchEiaRange(key, eiaWindow.from, eiaWindow.to)
    ),
    runKeylessSource("worldbank", () => fetchWorldBankMonthly(pinkSheetWindow)),
    runKeylessSource("nationalgas", () => fetchGbGasSapRange(sapWindow.from, sapWindow.to)),
  ]);

  const ingestStatuses = await Promise.all([
    ingestSource("eia", eia, rejectCrossWiredPriceRows(eia.rowsData ?? [])),
    ingestSource("worldbank", worldbank, selectCronWorldBankRows(worldbank.rowsData ?? [])),
    ingestSource("nationalgas", sap, rejectCrossWiredPriceRows(sap.rowsData ?? [])),
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
