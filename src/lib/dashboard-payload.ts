import { filterPublicCommodityPrices } from "@/lib/commodity-series";
import { queryPipe } from "@/lib/tinybird";
import type {
  CommodityPrice,
  CommodityRange,
  EnergySnapshot,
  Generation5min,
  TimeRange,
} from "@/lib/types";
import {
  historicalCachePolicy,
  liveCachePolicy,
  longCachePolicy,
  TINYBIRD_CACHE_SECONDS,
} from "@/lib/tinybird-cache";
import { readThroughCache } from "@/lib/redis-cache";
import {
  resolveDashboardDate,
  type DashboardDateResolution,
} from "@/lib/dashboard-search-params";
import {
  chartRangeForPeriod,
  isNesoPeriod,
  tinybirdRangeForPeriod,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import {
  getHeadlineGenerationQueryParams,
  getGenerationQueryParams,
  getHeadlineSnapshotsQueryParams,
  getPricesQueryParams,
  getSnapshotsQueryParams,
} from "@/lib/dashboard-data";
import { getLatestFacts, type LatestFacts } from "@/lib/facts";
import { buildHistoricFacts } from "@/lib/historic-facts";
import type { LookAheadView } from "@/lib/forecast-model";
import { getLookAhead } from "@/lib/forecasts";
import { getGridRecords, getHistoricPeriodView } from "@/lib/neso-historic";
import {
  emptyRecordsWithDocumentedCoal,
  type GridRecords,
  type HistoricPeriodView,
} from "@/lib/historic-mix";
export type DashboardPayload = {
  period: DashboardPeriod;
  chartRange: TimeRange;
  dateResolution: DashboardDateResolution;
  facts: LatestFacts;
  snapshots: EnergySnapshot[];
  headlineSnapshots: EnergySnapshot[];
  generationHistory: Generation5min[];
  headlineGeneration: Generation5min[];
  prices: CommodityPrice[];
  records: GridRecords | null;
  historicView: HistoricPeriodView | null;
  transitionView: HistoricPeriodView | null;
  lookAhead: LookAheadView | null;
};

export type LoadDashboardPayloadInput = {
  period: DashboardPeriod;
  date?: string | null;
  commodityRange?: CommodityRange;
  now?: Date;
};

export function dashboardPayloadCacheKey(
  period: DashboardPeriod,
  date: string | null,
  commodityRange: CommodityRange
): string {
  return `dashboard:${period}:${date ?? ""}:${commodityRange}`;
}

export function dashboardPayloadPolicy(period: DashboardPeriod) {
  return isNesoPeriod(period) ? historicalCachePolicy() : liveCachePolicy();
}

export async function loadDashboardPayload(
  input: LoadDashboardPayloadInput
): Promise<DashboardPayload> {
  const now = input.now ?? new Date();
  const commodityRange = input.commodityRange ?? "90d";
  const date = input.date ?? null;
  const tinybirdRange = tinybirdRangeForPeriod(input.period, chartRangeForPeriod(input.period, "24h"));
  const dateResolution = resolveDashboardDate(date, now, tinybirdRange);
  const cacheDate = dateResolution.status === "historical" ? dateResolution.date : null;

  return readThroughCache(
    dashboardPayloadCacheKey(input.period, cacheDate, commodityRange),
    dashboardPayloadPolicy(input.period),
    () =>
      loadDashboardPayloadUncached({
        period: input.period,
        date,
        commodityRange,
        now,
      })
  );
}

export async function loadDashboardPayloadUncached(
  input: Required<Pick<LoadDashboardPayloadInput, "period" | "commodityRange">> & {
    date?: string | null;
    now: Date;
  }
): Promise<DashboardPayload> {
  const now = input.now;
  const period = input.period;
  const commodityRange = input.commodityRange;
  const chartRange = chartRangeForPeriod(period, "24h");
  const tinybirdRange = tinybirdRangeForPeriod(period, chartRange);
  const neso = isNesoPeriod(period);
  const dateResolution = resolveDashboardDate(input.date, now, tinybirdRange);
  const headlineDate = dateResolution.status === "historical" ? dateResolution.date : null;
  const skipGrid = dateResolution.status === "empty" || neso;
  const noSnapshots: EnergySnapshot[] = [];
  const noGeneration: Generation5min[] = [];
  const noPrices: CommodityPrice[] = [];

  let snapshots: EnergySnapshot[] = [];
  let headlineSnapshots: EnergySnapshot[] = [];
  let prices: CommodityPrice[] = [];
  let generationHistory: Generation5min[] = [];
  let headlineGeneration: Generation5min[] = [];
  let historicView: HistoricPeriodView | null = null;
  let transitionView: HistoricPeriodView | null = null;
  let records: GridRecords | null = null;
  let lookAhead: LookAheadView | null = null;

  try {
    const historicPeriod = period === "year" || period === "all" ? period : null;
    const [tinybird, allHistoric, periodHistoric, gridRecords, forecastView] = await Promise.all([
      Promise.all([
        skipGrid
          ? Promise.resolve(noSnapshots)
          : queryPipe<EnergySnapshot>(
              "snapshots_range",
              getSnapshotsQueryParams(tinybirdRange, now, headlineDate),
              { range: tinybirdRange, date: headlineDate, now }
            ),
        skipGrid
          ? Promise.resolve(noSnapshots)
          : queryPipe<EnergySnapshot>(
              "snapshots_range",
              getHeadlineSnapshotsQueryParams(now, headlineDate),
              { range: "24h", date: headlineDate, now }
            ).catch(() => noSnapshots),
        queryPipe<CommodityPrice>(
          "prices_range",
          getPricesQueryParams(commodityRange, now),
          { range: commodityRange, now }
        ).catch(() => noPrices),
        skipGrid
          ? Promise.resolve(noGeneration)
          : queryPipe<Generation5min>(
              "generation_5min_range",
              getGenerationQueryParams(tinybirdRange, now, headlineDate),
              { range: tinybirdRange, date: headlineDate, now }
            ).catch(() => noGeneration),
        skipGrid
          ? Promise.resolve(noGeneration)
          : queryPipe<Generation5min>(
              "generation_5min_range",
              getHeadlineGenerationQueryParams(now, headlineDate),
              { range: "24h", date: headlineDate, now }
            ).catch(() => noGeneration),
      ]),
      getHistoricPeriodView("all", now).catch(() => null),
      historicPeriod === "year"
        ? getHistoricPeriodView("year", now).catch(() => null)
        : Promise.resolve(null),
      getGridRecords(now).catch(() => emptyRecordsWithDocumentedCoal(now)),
      getLookAhead().catch(() => null),
    ]);

    [snapshots, headlineSnapshots, prices, generationHistory, headlineGeneration] = tinybird;
    transitionView = allHistoric;
    historicView =
      historicPeriod === "year" ? periodHistoric : historicPeriod === "all" ? allHistoric : null;
    records = gridRecords;
    lookAhead = forecastView;
  } catch {
    snapshots = noSnapshots;
    headlineSnapshots = noSnapshots;
    prices = noPrices;
    generationHistory = noGeneration;
    headlineGeneration = noGeneration;
    records = emptyRecordsWithDocumentedCoal(now);
  }

  if (historicView) {
    snapshots = historicView.snapshots;
    headlineSnapshots = historicView.snapshots;
    generationHistory = historicView.generation;
    headlineGeneration = historicView.generation;
  }

  const facts =
    historicView && (period === "year" || period === "all")
      ? buildHistoricFacts(historicView, period, now)
      : getLatestFacts({
          resolution: dateResolution,
          snapshots: headlineSnapshots,
          generation: headlineGeneration,
          now,
        });

  return {
    period,
    chartRange,
    dateResolution,
    facts,
    snapshots,
    headlineSnapshots,
    generationHistory,
    headlineGeneration,
    prices: filterPublicCommodityPrices(prices),
    records,
    historicView,
    transitionView,
    lookAhead,
  };
}

export function pricesCachePolicy(range: CommodityRange) {
  switch (range) {
    case "30d":
      return longCachePolicy(TINYBIRD_CACHE_SECONDS.long);
    case "90d":
    case "1y":
      return longCachePolicy(TINYBIRD_CACHE_SECONDS.longYear);
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}
