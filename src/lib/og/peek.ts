import { dashboardPayloadCacheKey, dashboardPayloadPolicy } from "@/lib/dashboard-payload-model";
import type { DashboardPayload } from "@/lib/dashboard-payload-model";
import { externalCacheKey, peekThroughCache } from "@/lib/redis-cache";
import { historicalCachePolicy, getTinybirdCachePolicy, tinybirdLogicalCacheKey } from "@/lib/tinybird-cache";
import { computeRecords, type GridRecords, type NesoHistoricRow } from "@/lib/historic-mix";
import type { LatestFacts } from "@/lib/facts";
import type { CommodityPrice } from "@/lib/types";

export type OgCacheSnapshot = {
  facts: LatestFacts | null;
  records: GridRecords | null;
  prices: CommodityPrice[] | null;
};

export async function peekLatestDashboardPayload(): Promise<DashboardPayload | null> {
  return peekThroughCache<DashboardPayload>(
    dashboardPayloadCacheKey("day", null),
    dashboardPayloadPolicy("day")
  );
}

export async function peekLatestPrices(): Promise<CommodityPrice[] | null> {
  const policy = getTinybirdCachePolicy({ pipeName: "latest_prices" });
  return peekThroughCache<CommodityPrice[]>(
    tinybirdLogicalCacheKey({
      pipeName: "latest_prices",
      revalidateSeconds: policy.revalidateSeconds,
    }),
    policy
  );
}

export async function peekCachedGridRecords(now = new Date()): Promise<GridRecords | null> {
  const rows = await peekThroughCache<NesoHistoricRow[]>(
    externalCacheKey("neso-historic", ["records"]),
    historicalCachePolicy()
  );
  if (!rows) {
    return null;
  }
  return computeRecords(rows, now);
}

export async function peekOgCacheSnapshot(now = new Date()): Promise<OgCacheSnapshot> {
  const [dashboard, prices, nesoRecords] = await Promise.all([
    peekLatestDashboardPayload(),
    peekLatestPrices(),
    peekCachedGridRecords(now),
  ]);

  return {
    facts: dashboard?.facts ?? null,
    records: dashboard?.records ?? nesoRecords,
    prices,
  };
}
