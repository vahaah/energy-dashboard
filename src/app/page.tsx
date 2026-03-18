import { Dashboard } from "@/components/dashboard";
import { queryPipe } from "@/lib/tinybird";
import type {
  EnergySnapshot,
  CommodityPrice,
  Generation5min,
} from "@/lib/types";
import { loadDashboardSearchParams } from "@/lib/dashboard-search-params.server";
import {
  getEffectiveDashboardDate,
  getGenerationQueryParams,
  getPricesQueryParams,
  getSnapshotsQueryParams,
} from "@/lib/dashboard-data";

/**
 * Main page — Server Component.
 *
 * Fetches initial data from Tinybird at build/request time (ISR 5 min).
 * Passes it to the client-side Dashboard for interactive charts.
 *
 * If Tinybird is not configured yet, renders with empty data gracefully.
 */
export const revalidate = 300; // ISR: regenerate every 5 min

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let snapshots: EnergySnapshot[] = [];
  let prices: CommodityPrice[] = [];
  let generationHistory: Generation5min[] = [];
  let latestGeneration: Generation5min[] = [];
  const dashboardSearchParams = await loadDashboardSearchParams(searchParams);
  let selectedDate = getEffectiveDashboardDate(dashboardSearchParams.date);
  let todayDate = selectedDate;

  try {
    const now = new Date();
    selectedDate = getEffectiveDashboardDate(dashboardSearchParams.date, now);
    todayDate = getEffectiveDashboardDate(null, now);

    [snapshots, prices, generationHistory, latestGeneration] = await Promise.all([
      queryPipe<EnergySnapshot>(
        "snapshots_range",
        getSnapshotsQueryParams(
          dashboardSearchParams.range,
          now,
          dashboardSearchParams.date
        )
      ),
      queryPipe<CommodityPrice>(
        "prices_range",
        getPricesQueryParams(dashboardSearchParams.commodityRange, now)
      ),
      queryPipe<Generation5min>(
        "generation_5min_range",
        getGenerationQueryParams(
          dashboardSearchParams.range,
          now,
          dashboardSearchParams.date
        )
      ).catch(() => []),
      queryPipe<Generation5min>("latest_generation", {}).catch(() => []),
    ]);
  } catch {
    // Tinybird not configured yet — render with empty data
    console.log(
      "Tinybird query failed (likely not configured yet). Rendering empty dashboard."
    );
  }

  return (
    <Dashboard
      searchParams={dashboardSearchParams}
      selectedDate={selectedDate}
      todayDate={todayDate}
      initialSnapshots={snapshots}
      initialPrices={prices}
      generationHistory={generationHistory}
      latestGeneration={latestGeneration}
    />
  );
}
