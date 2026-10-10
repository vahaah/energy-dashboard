import { Dashboard } from "@/components/dashboard";
import { filterPublicCommodityPrices } from "@/lib/commodity-series";
import { queryPipe } from "@/lib/tinybird";
import type {
  EnergySnapshot,
  CommodityPrice,
  Generation5min,
} from "@/lib/types";
import { loadDashboardSearchParams } from "@/lib/dashboard-search-params.server";
import { resolveDashboardDate } from "@/lib/dashboard-search-params";
import {
  chartRangeForPeriod,
  isNesoPeriod,
  selectedPeriod,
  tinybirdRangeForPeriod,
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
import { getGridRecords, getHistoricPeriodView } from "@/lib/neso-historic";
import {
  emptyRecordsWithDocumentedCoal,
  type GridRecords,
  type HistoricPeriodView,
} from "@/lib/historic-mix";

/**
 * Main page — Server Component.
 *
 * Day/Week fetch Tinybird grid pipes. Year/All time use NESO historic mix
 * (cached 24h, zero Tinybird grid requests). Commodity prices still use the
 * cached prices_range tiers (30d / 90d / 1y).
 */
export const revalidate = 300;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let snapshots: EnergySnapshot[] = [];
  let headlineSnapshots: EnergySnapshot[] = [];
  let prices: CommodityPrice[] = [];
  let generationHistory: Generation5min[] = [];
  let headlineGeneration: Generation5min[] = [];
  let historicView: HistoricPeriodView | null = null;
  let transitionView: HistoricPeriodView | null = null;
  let records: GridRecords | null = null;
  const dashboardSearchParams = await loadDashboardSearchParams(searchParams);
  const now = new Date();
  const period = selectedPeriod(dashboardSearchParams.period, dashboardSearchParams.range);
  const chartRange = chartRangeForPeriod(period, dashboardSearchParams.range);
  const tinybirdRange = tinybirdRangeForPeriod(period, dashboardSearchParams.range);
  const neso = isNesoPeriod(period);
  const dateResolution = resolveDashboardDate(
    dashboardSearchParams.date,
    now,
    tinybirdRange
  );
  const headlineDate =
    dateResolution.status === "historical" ? dateResolution.date : null;
  const skipGrid = dateResolution.status === "empty" || neso;
  const noSnapshots: EnergySnapshot[] = [];
  const noGeneration: Generation5min[] = [];
  const noPrices: CommodityPrice[] = [];

  try {
    const historicPeriod = period === "year" || period === "all" ? period : null;
    const [tinybird, allHistoric, periodHistoric, gridRecords] = await Promise.all([
      Promise.all([
        skipGrid
          ? Promise.resolve(noSnapshots)
          : queryPipe<EnergySnapshot>(
              "snapshots_range",
              getSnapshotsQueryParams(
                tinybirdRange,
                now,
                headlineDate
              ),
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
          getPricesQueryParams(dashboardSearchParams.commodityRange, now),
          { range: dashboardSearchParams.commodityRange, now }
        ).catch(() => noPrices),
        skipGrid
          ? Promise.resolve(noGeneration)
          : queryPipe<Generation5min>(
              "generation_5min_range",
              getGenerationQueryParams(
                tinybirdRange,
                now,
                headlineDate
              ),
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
    ]);

    [snapshots, headlineSnapshots, prices, generationHistory, headlineGeneration] = tinybird;
    transitionView = allHistoric;
    historicView =
      historicPeriod === "year" ? periodHistoric : historicPeriod === "all" ? allHistoric : null;
    records = gridRecords;
  } catch {
    console.log(
      "Dashboard query failed (Tinybird or NESO). Rendering empty dashboard."
    );
  }

  if (historicView) {
    snapshots = historicView.snapshots;
    headlineSnapshots = historicView.snapshots;
    generationHistory = historicView.generation;
    headlineGeneration = historicView.generation;
  }

  const facts = historicView && (period === "year" || period === "all")
    ? buildHistoricFacts(historicView, period, now)
    : getLatestFacts({
        resolution: dateResolution,
        snapshots: headlineSnapshots,
        generation: headlineGeneration,
        now,
      });

  return (
    <Dashboard
      searchParams={dashboardSearchParams}
      selectedDate={dateResolution.date}
      todayDate={dateResolution.today}
      facts={facts}
      initialSnapshots={snapshots}
      headlineSnapshots={headlineSnapshots}
      initialPrices={filterPublicCommodityPrices(prices)}
      generationHistory={generationHistory}
      headlineGeneration={headlineGeneration}
      records={records}
      historicView={historicView}
      transitionView={transitionView}
      period={period}
      chartRange={chartRange}
    />
  );
}
