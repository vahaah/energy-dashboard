import {
  filterCanonicalCommodityPrices,
  isMonthlyPublicCommodity,
} from "@/lib/commodity-series";
import { fetchJson } from "@/lib/http";
import { addUtcDays, formatIsoDate } from "@/lib/london-time";
import type { EIAPriceData } from "@/lib/types";

export const EIA_COMMODITIES = [
  { series: "PET.RBRTE.D", commodity: "brent_crude", unit: "$/BBL", currency: "USD" },
  { series: "PET.RWTC.D", commodity: "wti_crude", unit: "$/BBL", currency: "USD" },
  { series: "NG.RNGWHHD.D", commodity: "henry_hub_gas", unit: "$/MMBTU", currency: "USD" },
] as const;

// Withdrawn. Leftover helpers — not fetched by cron or backfill.
export const FRED_COMMODITIES = [
  { id: "PNGASEUUSDM", commodity: "eu_natural_gas", unit: "$/MMBTU", currency: "USD" },
  { id: "PNGASJPUSDM", commodity: "lng_asia", unit: "$/MMBTU", currency: "USD" },
] as const;

// Withdrawn. Leftover helper — not fetched by cron or backfill.
export const OILPRICE_COMMODITIES = [
  { code: "DUTCH_TTF_EUR", commodity: "eu_ttf", unit: "EUR/MWh", currency: "EUR" },
] as const;

export type PriceRow = {
  date: string;
  commodity: string;
  price: number;
  currency: string;
  unit: string;
};

export const EIA_CRON_LOOKBACK_DAYS = 30;
export const EIA_BACKFILL_LOOKBACK_DAYS = 400;
/** First `/api/cron-prices` slot after 00:00 UTC (vercel.json 00:30 / 06:30 / 12:30 / 18:30). */
export const EIA_BACKFILL_CRON_UTC_HOUR = 0;
export const EIA_SOURCE_CREDIT = "Source: U.S. Energy Information Administration";

export function eiaApiKeyFromEnv(value: string | undefined): string | null {
  if (!value || value === "DEMO_KEY") {
    return null;
  }
  return value;
}

export function isEiaBackfillCronSlot(utcHour: number): boolean {
  return utcHour === EIA_BACKFILL_CRON_UTC_HOUR;
}

export function eiaCronLookbackDays(utcHour: number): number {
  return isEiaBackfillCronSlot(utcHour)
    ? EIA_BACKFILL_LOOKBACK_DAYS
    : EIA_CRON_LOOKBACK_DAYS;
}

export function eiaCronWindow(now: Date): { from: string; to: string } {
  const to = formatIsoDate(now);
  return { from: addUtcDays(to, -eiaCronLookbackDays(now.getUTCHours())), to };
}

export function buildEiaSeriesUrl(
  series: string,
  apiKey: string,
  start: string,
  end: string
): string {
  const url = new URL(`https://api.eia.gov/v2/seriesid/${series}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "asc");
  url.searchParams.set("length", "5000");
  return url.toString();
}

export async function fetchEiaRange(
  apiKey: string,
  start: string,
  end: string
): Promise<PriceRow[]> {
  const batches = await Promise.all(
    EIA_COMMODITIES.map(async ({ series, commodity, unit, currency }) => {
      const json = await fetchJson<{ response?: { data?: EIAPriceData[] } }>(
        buildEiaSeriesUrl(series, apiKey, start, end)
      );
      const rows: PriceRow[] = [];
      for (const row of json.response?.data ?? []) {
        if (row.value == null) {
          continue;
        }
        rows.push({
          date: row.period,
          commodity,
          price: row.value,
          currency,
          unit,
        });
      }
      return rows;
    })
  );

  return dedupePriceRows(batches.flat());
}

export async function fetchEiaLatest(apiKey: string, now = new Date()): Promise<PriceRow[]> {
  const window = eiaCronWindow(now);
  return fetchEiaRange(apiKey, window.from, window.to);
}

export function commodityDateKey(date: string): string {
  return date.slice(0, 10);
}

export function latestCommodityDate(
  rows: Array<{ commodity: string; date: string }>,
  commodity: string
): string | null {
  const row = rows.find((entry) => entry.commodity === commodity);
  return row ? commodityDateKey(row.date) : null;
}

export const REQUIRED_PRICE_CRON_SOURCE = "eia";
export const REQUIRED_PRICE_CRON_SOURCES = ["eia", "worldbank"] as const;

export function isRequiredPriceCronSource(source: string): boolean {
  for (const required of REQUIRED_PRICE_CRON_SOURCES) {
    if (required === source) {
      return true;
    }
  }
  return false;
}

export function priceRowKey(row: { commodity: string; date: string }): string {
  return `${row.commodity}|${commodityDateKey(row.date)}`;
}

export function dedupePriceRows(rows: PriceRow[]): PriceRow[] {
  const byKey = new Map<string, PriceRow>();
  for (const row of rows) {
    byKey.set(priceRowKey(row), {
      ...row,
      date: commodityDateKey(row.date),
    });
  }
  return Array.from(byKey.values()).sort((left, right) => {
    const byDate = left.date.localeCompare(right.date);
    if (byDate !== 0) {
      return byDate;
    }
    return left.commodity.localeCompare(right.commodity);
  });
}

export function rejectStoredPriceRows(
  rows: PriceRow[],
  stored: Iterable<{ commodity: string; date: string }>
): PriceRow[] {
  const keys = new Set(Array.from(stored, (row) => priceRowKey(row)));
  return rows.filter((row) => !keys.has(priceRowKey(row)));
}

/**
 * EIA / SAP skip already-stored (commodity, date) keys.
 * World Bank monthly series (`eu_natural_gas`, `lng_asia`) are always kept so
 * ReplacingMergeTree last-insert-wins can replace leftover FRED / OilPrice values.
 */
export function selectPriceRowsForIngest(
  rows: PriceRow[],
  stored: Iterable<{ commodity: string; date: string }>
): PriceRow[] {
  const keys = new Set(Array.from(stored, (row) => priceRowKey(row)));
  return rows.filter(
    (row) => isMonthlyPublicCommodity(row.commodity) || !keys.has(priceRowKey(row))
  );
}

/**
 * Leftover helper. OilPriceAPI ingest is disabled in cron and backfill.
 * vercel.json cron-prices still runs at minute 30 of every 6th hour.
 */
export const OILPRICE_TTF_CRON_UTC_HOUR = 0;

export function isOilPriceTtfCronSlot(utcHour: number): boolean {
  return utcHour === OILPRICE_TTF_CRON_UTC_HOUR;
}

/**
 * Leftover helper. OilPriceAPI ingest is disabled — cron and backfill
 * never call this.
 */
export function shouldFetchOilPriceTtf(
  today: string,
  latestTtfDate: string | null,
  utcHour: number
): boolean {
  return isOilPriceTtfCronSlot(utcHour) && commodityDateKey(latestTtfDate ?? "") !== today;
}

/** Leftover helper. Not called by cron or backfill. */
export async function fetchOilPriceLatest(
  apiKey: string,
  today: string
): Promise<PriceRow[]> {
  const results = await Promise.all(
    OILPRICE_COMMODITIES.map(async ({ code, commodity, unit, currency }) => {
      const json = await fetchJson<{ data?: { price?: number } }>(
        `https://api.oilpriceapi.com/v1/prices/latest?by_code=${code}`,
        { headers: { Authorization: `Token ${apiKey}` } }
      );
      const price = json.data?.price;
      if (price == null) {
        return null;
      }
      return { date: today, commodity, price, currency, unit };
    })
  );

  return results.filter((row) => row != null);
}

/** Leftover helper. Not called by cron or backfill. */
export async function fetchFredLatest(apiKey: string): Promise<PriceRow[]> {
  const results = await Promise.all(
    FRED_COMMODITIES.map(async ({ id, commodity, unit, currency }) => {
      const json = await fetchJson<{
        observations?: Array<{ date: string; value: string }>;
      }>(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`
      );
      const observation = json.observations?.[0];
      if (!observation || observation.value === "." || observation.value == null) {
        return null;
      }
      return {
        date: observation.date,
        commodity,
        price: Number.parseFloat(observation.value),
        currency,
        unit,
      };
    })
  );

  return results.filter((row) => row != null);
}

export function mergePriceRows(preferred: PriceRow[], fallback: PriceRow[]): PriceRow[] {
  const merged = [...preferred];
  for (const row of fallback) {
    if (!merged.some((existing) => existing.commodity === row.commodity)) {
      merged.push(row);
    }
  }
  return merged;
}

export function rejectCrossWiredPriceRows(rows: PriceRow[]): PriceRow[] {
  return filterCanonicalCommodityPrices(rows);
}

/** Cron always writes World Bank monthly rows, even when the key already exists. */
export function selectCronWorldBankRows(
  rows: PriceRow[],
  stored: Iterable<{ commodity: string; date: string }> = []
): PriceRow[] {
  return selectPriceRowsForIngest(rejectCrossWiredPriceRows(rows), stored);
}
