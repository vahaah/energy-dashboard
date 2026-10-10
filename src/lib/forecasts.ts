import { cache } from "react";
import { unstable_cache } from "next/cache";
import { NESO_EMBEDDED_FORECAST_RESOURCE_ID } from "@/lib/attribution";
import {
  lookAheadFromRows,
  parseEmbeddedForecastRows,
  type CachedForecastRows,
  type CarbonForecastRow,
  type DemandForecastRow,
  type EmbeddedForecastRow,
  type LookAheadView,
  type WindForecastRow,
} from "@/lib/forecast-model";
import { fetchJson } from "@/lib/http";
import { getLondonDate } from "@/lib/london-time";
import { externalCacheKey, readThroughCache } from "@/lib/redis-cache";
import { longCachePolicy } from "@/lib/tinybird-cache";
import type { CarbonIntensityResponse } from "@/lib/types";

export const FORECAST_REVALIDATE_SECONDS = 1_800;
export const FORECAST_CACHE_TAG = "forecasts";
export const FORECAST_CACHE_KEY = "grid-look-ahead";

export const CARBON_FORECAST_URL = "https://api.carbonintensity.org.uk/intensity";
export const WINDFOR_URL = "https://data.elexon.co.uk/bmrs/api/v1/forecast/generation/wind";
export const NDF_URL = "https://data.elexon.co.uk/bmrs/api/v1/forecast/demand/day-ahead";
export const NESO_EMBEDDED_FORECAST_SQL_URL =
  "https://api.neso.energy/api/3/action/datastore_search_sql";

export {
  carbonForecastPoints,
  DEMAND_FORECAST_EMBEDDED_BASIS,
  DEMAND_FORECAST_TRANSMISSION_BASIS,
  demandForecastPoints,
  emptyLookAhead,
  embeddedForecastByTime,
  hasCompleteOverlappingEmbedded,
  parseEmbeddedForecastRows,
  formatGridFetchedAt,
  formatLookAheadWindow,
  greenestWindow,
  lookAheadFromRows,
  lookAheadFromPublic,
  publicLookAhead,
  showsCarbonForecast,
  showsDemandForecast,
  showsLookAheadCopy,
  windLookAhead,
  WIND_FORECAST_BASIS,
} from "@/lib/forecast-model";
export type {
  DemandForecastBasis,
  ForecastPoint,
  GreenestWindow,
  LookAheadView,
  PublicLookAhead,
  WindLookAhead,
} from "@/lib/forecast-model";

export function forecastRequestInit(): RequestInit & {
  cache: RequestCache;
  next: { revalidate: number; tags: string[] };
} {
  return {
    cache: "no-store",
    next: { revalidate: FORECAST_REVALIDATE_SECONDS, tags: [FORECAST_CACHE_TAG] },
    signal: AbortSignal.timeout(15_000),
  };
}

export function carbonForecastUrl(now: Date): string {
  return `${CARBON_FORECAST_URL}/${now.toISOString().replace(".000", "")}/fw48h`;
}

export function forecastCacheControl(): string {
  return `public, s-maxage=${FORECAST_REVALIDATE_SECONDS}, stale-while-revalidate=86400`;
}

export async function fetchForecastRows(now: Date): Promise<CachedForecastRows> {
  const [carbonRows, windRows, demandRows, embeddedRows] = await Promise.all([
    fetchCarbonForecast48h(now).catch(() => null),
    fetchWindForecast().catch(() => null),
    fetchDemandForecast(now).catch(() => null),
    fetchEmbeddedForecast(now).catch(() => null),
  ]);

  return {
    fetchedAt: now.toISOString(),
    carbonRows,
    windRows,
    demandRows,
    embeddedRows,
  };
}

export async function loadLookAhead(now: Date): Promise<LookAheadView> {
  return lookAheadFromRows(await fetchForecastRows(now), now);
}

const cachedForecastRows = unstable_cache(
  async () => fetchForecastRows(new Date()),
  [FORECAST_CACHE_KEY],
  { revalidate: FORECAST_REVALIDATE_SECONDS, tags: [FORECAST_CACHE_TAG] }
);

export const getLookAhead = cache(async (): Promise<LookAheadView> => {
  const rows = await readThroughCache(
    externalCacheKey("forecasts", [FORECAST_CACHE_KEY]),
    longCachePolicy(FORECAST_REVALIDATE_SECONDS),
    () => cachedForecastRows()
  );
  return lookAheadFromRows(rows, new Date());
});

export async function fetchCarbonForecast48h(now: Date): Promise<CarbonForecastRow[]> {
  return readThroughCache(
    externalCacheKey("carbon-intensity", ["forecast-48h"]),
    longCachePolicy(FORECAST_REVALIDATE_SECONDS),
    async () => {
      const json = await fetchJson<CarbonIntensityResponse>(
        carbonForecastUrl(now),
        forecastRequestInit()
      );
      return json.data ?? [];
    }
  );
}

export async function fetchWindForecast(): Promise<WindForecastRow[]> {
  return readThroughCache(
    externalCacheKey("elexon", ["windfor"]),
    longCachePolicy(FORECAST_REVALIDATE_SECONDS),
    async () => {
      const json = await fetchJson<{ data: WindForecastRow[] }>(
        WINDFOR_URL,
        forecastRequestInit()
      );
      return json.data ?? [];
    }
  );
}

export function ndfUrl(now: Date): string {
  const from = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  return `${NDF_URL}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function fetchDemandForecast(now: Date): Promise<DemandForecastRow[]> {
  return readThroughCache(
    externalCacheKey("elexon", ["ndf"]),
    longCachePolicy(FORECAST_REVALIDATE_SECONDS),
    async () => {
      const json = await fetchJson<{ data: DemandForecastRow[] }>(
        ndfUrl(now),
        forecastRequestInit()
      );
      return json.data ?? [];
    }
  );
}

export function nesoEmbeddedForecastSql(fromDate: string): string {
  return [
    'SELECT "SETTLEMENT_DATE","SETTLEMENT_PERIOD","DATE_GMT","TIME_GMT","EMBEDDED_WIND_FORECAST","EMBEDDED_SOLAR_FORECAST"',
    `FROM "${NESO_EMBEDDED_FORECAST_RESOURCE_ID}"`,
    `WHERE "SETTLEMENT_DATE" >= '${fromDate}'`,
    'ORDER BY "SETTLEMENT_DATE","SETTLEMENT_PERIOD"',
  ].join(" ");
}

export async function fetchEmbeddedForecast(now: Date): Promise<EmbeddedForecastRow[]> {
  const sql = nesoEmbeddedForecastSql(getLondonDate(now));
  const json = await fetchJson<{
    success?: boolean;
    result?: { records?: Array<Record<string, unknown>> };
  }>(`${NESO_EMBEDDED_FORECAST_SQL_URL}?sql=${encodeURIComponent(sql)}`, forecastRequestInit());
  if (json.success === false) {
    throw new Error("NESO embedded forecast query failed");
  }
  return parseEmbeddedForecastRows(json.result?.records ?? []);
}
