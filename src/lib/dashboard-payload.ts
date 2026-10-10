import { queryPipe } from "@/lib/tinybird";
import type { EnergySnapshot, Generation5min } from "@/lib/types";
import { readThroughCacheResult, type CacheRead } from "@/lib/redis-cache";
import { resolveDashboardDate } from "@/lib/dashboard-search-params";
import {
  chartRangeForPeriod,
  isNesoPeriod,
  tinybirdRangeForPeriod,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import {
  getGenerationQueryParams,
  getHeadlineGenerationQueryParams,
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
  compactDashboardPayload,
  dashboardPayloadCacheDate,
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  headlineWindow,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";

export type { DashboardPayload } from "@/lib/dashboard-payload-model";
export {
  compactDashboardPayload,
  compactHistoricPayload,
  dashboardPayloadCacheDate,
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  downsampleGeneration,
  downsampleSnapshots,
  headlineWindow,
  hydrateDashboardPayload,
  payloadJsonBytes,
  slimFactsForClient,
} from "@/lib/dashboard-payload-model";

export type LoadDashboardPayloadInput = {
  period: DashboardPeriod;
  date?: string | null;
  now?: Date;
};

export async function loadDashboardPayload(
  input: LoadDashboardPayloadInput
): Promise<DashboardPayload> {
  return (await loadDashboardPayloadResult(input)).data;
}

export async function loadDashboardPayloadResult(
  input: LoadDashboardPayloadInput
): Promise<CacheRead<DashboardPayload>> {
  const now = input.now ?? new Date();
  const date = input.date ?? null;
  const tinybirdRange = tinybirdRangeForPeriod(input.period, chartRangeForPeriod(input.period, "24h"));
  const dateResolution = resolveDashboardDate(date, now, tinybirdRange);
  const cacheDate = dashboardPayloadCacheDate(dateResolution, date);

  return readThroughCacheResult(
    dashboardPayloadCacheKey(input.period, cacheDate),
    dashboardPayloadPolicy(input.period),
    () =>
      loadDashboardPayloadUncached({
        period: input.period,
        date,
        now,
      }).then(compactDashboardPayload)
  );
}

export async function loadDashboardPayloadUncached(
  input: Required<Pick<LoadDashboardPayloadInput, "period">> & {
    date?: string | null;
    now: Date;
  }
): Promise<DashboardPayload> {
  const now = input.now;
  const period = input.period;
  const chartRange = chartRangeForPeriod(period, "24h");
  const tinybirdRange = tinybirdRangeForPeriod(period, chartRange);
  const neso = isNesoPeriod(period);
  const dateResolution = resolveDashboardDate(input.date, now, tinybirdRange);
  const headlineDate = dateResolution.status === "historical" ? dateResolution.date : null;
  const skipGrid = dateResolution.status === "empty" || neso;
  const noSnapshots: EnergySnapshot[] = [];
  const noGeneration: Generation5min[] = [];

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
        ? Promise.resolve(noGeneration)
        : queryPipe<Generation5min>(
            "generation_5min_range",
            getGenerationQueryParams(tinybirdRange, now, headlineDate),
            { range: tinybirdRange, date: headlineDate, now }
          ).catch(() => noGeneration),
      skipGrid || !needsUnaggregatedHeadlineGeneration(period)
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

  const [gridSnapshots, gridGeneration, unaggregatedHeadlineGeneration] = tinybird;
  let snapshots = gridSnapshots;
  let generationHistory = gridGeneration;
  let headlineSnapshots = headlineWindow(snapshots);
  let headlineGeneration =
    unaggregatedHeadlineGeneration.length > 0
      ? unaggregatedHeadlineGeneration
      : headlineWindow(generationHistory);
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

  return compactDashboardPayload({
    period,
    chartRange,
    dateResolution,
    facts,
    snapshots,
    headlineSnapshots,
    generationHistory,
    headlineGeneration,
    prices: [],
    records,
    historicView,
    transitionView,
    lookAhead: lookAhead ? publicLookAhead(lookAhead) : null,
  });
}

function needsUnaggregatedHeadlineGeneration(period: DashboardPeriod): boolean {
  switch (period) {
    case "week":
      return true;
    case "day":
    case "year":
    case "all":
      return false;
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

