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
  getHeadlineGenerationQueryParams,
  getGenerationQueryParams,
  getHeadlineSnapshotsQueryParams,
  getPricesQueryParams,
  getSnapshotsQueryParams,
} from "@/lib/dashboard-data";
import { getLatestFacts } from "@/lib/facts";

/**
 * Main page — Server Component.
 *
 * Fetches initial data from Tinybird at build/request time (ISR 5 min).
 * Passes it to the client-side Dashboard for interactive charts.
 *
 * If Tinybird is not configured yet, renders with empty data gracefully.
 */
export const revalidate = 60;

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
  const dashboardSearchParams = await loadDashboardSearchParams(searchParams);
  const now = new Date();
  const dateResolution = resolveDashboardDate(dashboardSearchParams.date, now);
  const headlineDate =
    dateResolution.status === "historical" ? dateResolution.date : null;
  const skipGrid = dateResolution.status === "empty";
  const noSnapshots: EnergySnapshot[] = [];
  const noGeneration: Generation5min[] = [];

  try {
    [snapshots, headlineSnapshots, prices, generationHistory, headlineGeneration] =
      await Promise.all([
        skipGrid
          ? Promise.resolve(noSnapshots)
          : queryPipe<EnergySnapshot>(
              "snapshots_range",
              getSnapshotsQueryParams(
                dashboardSearchParams.range,
                now,
                dashboardSearchParams.date
              )
            ),
        skipGrid
          ? Promise.resolve(noSnapshots)
          : queryPipe<EnergySnapshot>(
              "snapshots_range",
              getHeadlineSnapshotsQueryParams(now, headlineDate)
            ).catch(() => noSnapshots),
        queryPipe<CommodityPrice>(
          "prices_range",
          getPricesQueryParams(dashboardSearchParams.commodityRange, now)
        ),
        skipGrid
          ? Promise.resolve(noGeneration)
          : queryPipe<Generation5min>(
              "generation_5min_range",
              getGenerationQueryParams(
                dashboardSearchParams.range,
                now,
                dashboardSearchParams.date
              )
            ).catch(() => noGeneration),
        skipGrid
          ? Promise.resolve(noGeneration)
          : queryPipe<Generation5min>(
              "generation_5min_range",
              getHeadlineGenerationQueryParams(now, headlineDate)
            ).catch(() => noGeneration),
      ]);
  } catch {
    // Tinybird not configured yet — render with empty data
    console.log(
      "Tinybird query failed (likely not configured yet). Rendering empty dashboard."
    );
  }

  const facts = getLatestFacts({
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
      initialPrices={filterPublicCommodityPrices(prices)}
      generationHistory={generationHistory}
    />
  );
}
