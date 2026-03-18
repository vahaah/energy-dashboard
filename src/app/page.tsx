import { Dashboard } from "@/components/dashboard";
import { queryPipe } from "@/lib/tinybird";
import type { EnergySnapshot, CommodityPrice } from "@/lib/types";

/**
 * Main page — Server Component.
 *
 * Fetches initial data from Tinybird at build/request time (ISR 5 min).
 * Passes it to the client-side Dashboard for interactive charts.
 *
 * If Tinybird is not configured yet, renders with empty data gracefully.
 */
export const revalidate = 300; // ISR: regenerate every 5 min

export default async function Home() {
  let snapshots: EnergySnapshot[] = [];
  let prices: CommodityPrice[] = [];

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    [snapshots, prices] = await Promise.all([
      queryPipe<EnergySnapshot>("snapshots_range", {
        start: yesterday.toISOString().replace("T", " ").slice(0, 19),
        end: now.toISOString().replace("T", " ").slice(0, 19),
      }),
      queryPipe<CommodityPrice>("prices_range", {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        end: now.toISOString().slice(0, 10),
      }),
    ]);
  } catch {
    // Tinybird not configured yet — render with empty data
    console.log("Tinybird query failed (likely not configured yet). Rendering empty dashboard.");
  }

  return <Dashboard initialSnapshots={snapshots} initialPrices={prices} />;
}
