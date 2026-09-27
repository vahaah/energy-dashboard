import { Dashboard } from "@/components/dashboard";
import { filterPublicCommodityPrices } from "@/lib/commodity-series";
import { latestObservedTimestamp } from "@/lib/health";
import { formatLondonClock, parseUtcDateTime } from "@/lib/london-time";
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
  getHeadlineSnapshotsQueryParams,
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
  let latestGeneration: Generation5min[] = [];
  const dashboardSearchParams = await loadDashboardSearchParams(searchParams);
  const now = new Date();
  const selectedDate = getEffectiveDashboardDate(dashboardSearchParams.date, now);
  const todayDate = getEffectiveDashboardDate(null, now);

  try {
    [snapshots, headlineSnapshots, prices, generationHistory, latestGeneration] = await Promise.all([
      queryPipe<EnergySnapshot>(
        "snapshots_range",
        getSnapshotsQueryParams(
          dashboardSearchParams.range,
          now,
          dashboardSearchParams.date
        )
      ),
      queryPipe<EnergySnapshot>(
        "snapshots_range",
        getHeadlineSnapshotsQueryParams(now)
      ).catch(() => []),
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
      dataAsOf={latestDataAsOf(headlineSnapshots, latestGeneration, now)}
      initialSnapshots={snapshots}
      headlineSnapshots={headlineSnapshots}
      initialPrices={filterPublicCommodityPrices(prices)}
      generationHistory={generationHistory}
      latestGeneration={latestGeneration}
    />
  );
}

function latestDataAsOf(
  snapshots: EnergySnapshot[],
  generation: Generation5min[],
  now: Date
): string | null {
  const latest = latestObservedTimestamp(
    [snapshots.at(-1)?.timestamp, ...generation.map((row) => row.timestamp)],
    now
  );
  if (!latest) {
    return null;
  }
  return formatLondonClock(parseUtcDateTime(latest));
}
