import { filterPublicCommodityPrices } from "@/lib/commodity-series";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice, CommodityRange, EnergySnapshot, Generation5min } from "@/lib/types";
import { longCachePolicy, TINYBIRD_CACHE_SECONDS } from "@/lib/tinybird-cache";
import { readThroughCache } from "@/lib/redis-cache";
import { resolveDashboardDate } from "@/lib/dashboard-search-params";
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
import { getLatestFacts } from "@/lib/facts";
import { buildHistoricFacts } from "@/lib/historic-facts";
import { publicLookAhead } from "@/lib/forecast-model";
import { getLookAhead } from "@/lib/forecasts";
import { getGridRecords, getHistoricPeriodView } from "@/lib/neso-historic";
import {
  emptyRecordsWithDocumentedCoal,
  type HistoricPeriodView,
} from "@/lib/historic-mix";
import {
  compactHistoricPayload,
  dashboardPayloadCacheDate,
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";

export type { DashboardPayload } from "@/lib/dashboard-payload-model";
export {
  compactHistoricPayload,
  dashboardPayloadCacheDate,
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  hydrateDashboardPayload,
} from "@/lib/dashboard-payload-model";

export type LoadDashboardPayloadInput = {
  period: DashboardPeriod;
  date?: string | null;
  commodityRange?: CommodityRange;
  now?: Date;
};

export async function loadDashboardPayload(
  input: LoadDashboardPayloadInput
): Promise<DashboardPayload> {
  const now = input.now ?? new Date();
  const commodityRange = input.commodityRange ?? "90d";
  const date = input.date ?? null;
  const tinybirdRange = tinybirdRangeForPeriod(input.period, chartRangeForPeriod(input.period, "24h"));
  const dateResolution = resolveDashboardDate(date, now, tinybirdRange);
  const cacheDate = dashboardPayloadCacheDate(dateResolution, date);

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
    getHistoricPeriodView("all", now).catch((error: unknown) => {
      if (historicPeriod === "all") {
        throw error;
      }
      return null;
    }),
    historicPeriod === "year"
      ? getHistoricPeriodView("year", now)
      : Promise.resolve(null),
    getGridRecords(now).catch(() => emptyRecordsWithDocumentedCoal(now)),
    getLookAhead().catch(() => null),
  ]);

  let [snapshots, headlineSnapshots, , generationHistory, headlineGeneration] = tinybird;
  const prices = tinybird[2];
  const transitionView = allHistoric;
  const historicView: HistoricPeriodView | null =
    historicPeriod === "year" ? periodHistoric : historicPeriod === "all" ? allHistoric : null;
  const records = gridRecords;
  const lookAhead = forecastView;

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

  return compactHistoricPayload({
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
    lookAhead: lookAhead ? publicLookAhead(lookAhead) : null,
  });
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
