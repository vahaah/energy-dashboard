import { filterCanonicalCommodityPrices } from "@/lib/commodity-series";
import { fetchJson } from "@/lib/http";
import type { EIAPriceData } from "@/lib/types";

export const EIA_COMMODITIES = [
  { series: "PET.RBRTE.D", commodity: "brent_crude", unit: "$/BBL", currency: "USD" },
  { series: "PET.RWTC.D", commodity: "wti_crude", unit: "$/BBL", currency: "USD" },
  { series: "NG.RNGWHHD.D", commodity: "henry_hub_gas", unit: "$/MMBTU", currency: "USD" },
] as const;

export const FRED_COMMODITIES = [
  { id: "PNGASEUUSDM", commodity: "eu_natural_gas", unit: "$/MMBTU", currency: "USD" },
  { id: "PNGASJPUSDM", commodity: "lng_asia", unit: "$/MMBTU", currency: "USD" },
] as const;

export const OILPRICE_COMMODITIES = [
  { code: "DUTCH_TTF_EUR", commodity: "eu_ttf", unit: "EUR/MWh", currency: "EUR" },
  { code: "JKM_LNG_USD", commodity: "lng_asia", unit: "$/MMBTU", currency: "USD" },
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
