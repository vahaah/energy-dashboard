import { filterCanonicalCommodityPrices } from "@/lib/commodity-series";
import { fetchJson } from "@/lib/http";
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

export async function fetchEiaLatest(apiKey: string): Promise<PriceRow[]> {
  const results = await Promise.all(
    EIA_COMMODITIES.map(async ({ series, commodity, unit, currency }) => {
      const json = await fetchJson<{ response?: { data?: EIAPriceData[] } }>(
        `https://api.eia.gov/v2/seriesid/${series}?api_key=${apiKey}`
      );
      const row = json.response?.data?.[0];
      if (row?.value == null) {
        return null;
      }
      return {
        date: row.period,
        commodity,
        price: row.value,
        currency,
        unit,
      };
    })
  );

  return results.filter((row) => row != null);
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

export function isRequiredPriceCronSource(source: string): boolean {
  return source === REQUIRED_PRICE_CRON_SOURCE;
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
