import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  carbonForecastPoints,
  demandForecastPoints,
  greenestWindow,
  windLookAhead,
  type CarbonForecastRow,
  type DemandForecastRow,
  type LookAheadView,
  type WindForecastRow,
} from "@/lib/forecast-model";
import { fetchJson } from "@/lib/http";
import type { CarbonIntensityResponse } from "@/lib/types";

export const FORECAST_REVALIDATE_SECONDS = 1_800;
export const FORECAST_CACHE_TAG = "forecasts";
export const FORECAST_CACHE_KEY = "grid-look-ahead";

export const CARBON_FORECAST_URL = "https://api.carbonintensity.org.uk/intensity";
export const WINDFOR_URL = "https://data.elexon.co.uk/bmrs/api/v1/forecast/generation/wind";
export const NDF_URL = "https://data.elexon.co.uk/bmrs/api/v1/forecast/demand/day-ahead";

export {
  carbonForecastPoints,
  demandForecastPoints,
  emptyLookAhead,
  formatGridFetchedAt,
  formatLookAheadWindow,
  greenestWindow,
  publicLookAhead,
  showsCarbonForecast,
  showsDemandForecast,
  windLookAhead,
  WIND_FORECAST_BASIS,
} from "@/lib/forecast-model";
export type {
  ForecastPoint,
  GreenestWindow,
  LookAheadView,
  PublicLookAhead,
  WindLookAhead,
} from "@/lib/forecast-model";

export function forecastRequestInit(): RequestInit & {
  next: { revalidate: number; tags: string[] };
} {
  return {
    next: { revalidate: FORECAST_REVALIDATE_SECONDS, tags: [FORECAST_CACHE_TAG] },
    signal: AbortSignal.timeout(12_000),
  };
}

export function carbonForecastUrl(now: Date): string {
  return `${CARBON_FORECAST_URL}/${now.toISOString().replace(".000", "")}/fw48h`;
}

export function forecastCacheControl(): string {
  return `public, s-maxage=${FORECAST_REVALIDATE_SECONDS}, stale-while-revalidate=3600`;
}

export async function loadLookAhead(now: Date): Promise<LookAheadView> {
  const fetchedAt = now.toISOString();
  const [carbonRows, windRows, demandRows] = await Promise.all([
    fetchCarbonForecast48h(now).catch(() => null),
    fetchWindForecast().catch(() => null),
    fetchDemandForecast().catch(() => null),
  ]);

  return {
    fetchedAt,
    greenest: carbonRows ? greenestWindow(carbonRows, now) : null,
    carbonSeries: carbonRows ? carbonForecastPoints(carbonRows, now) : [],
    wind: windRows ? windLookAhead(windRows, now) : null,
    demandSeries: demandRows ? demandForecastPoints(demandRows, now) : [],
  };
}

const cachedLookAhead = unstable_cache(
  async () => loadLookAhead(new Date()),
  [FORECAST_CACHE_KEY],
  { revalidate: FORECAST_REVALIDATE_SECONDS, tags: [FORECAST_CACHE_TAG] }
);

export const getLookAhead = cache(async (): Promise<LookAheadView> => {
  return cachedLookAhead();
});

export async function fetchCarbonForecast48h(now: Date): Promise<CarbonForecastRow[]> {
  const json = await fetchJson<CarbonIntensityResponse>(
    carbonForecastUrl(now),
    forecastRequestInit()
  );
  return json.data ?? [];
}

export async function fetchWindForecast(): Promise<WindForecastRow[]> {
  const json = await fetchJson<{ data: WindForecastRow[] }>(WINDFOR_URL, forecastRequestInit());
  return json.data ?? [];
}

export async function fetchDemandForecast(): Promise<DemandForecastRow[]> {
  const json = await fetchJson<{ data: DemandForecastRow[] }>(NDF_URL, forecastRequestInit());
  return json.data ?? [];
}
