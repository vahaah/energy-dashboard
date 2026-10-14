import {
  getHeadlineGenerationQueryParams,
  getHeadlineSnapshotsQueryParams,
  getPricesQueryParams,
} from "@/lib/dashboard-data";
import { dashboardPayloadCacheKey, dashboardPayloadPolicy } from "@/lib/dashboard-payload-model";
import type { DashboardPayload } from "@/lib/dashboard-payload-model";
import { resolveDashboardDate } from "@/lib/dashboard-search-params";
import { externalCacheKey, peekThroughCache } from "@/lib/redis-cache";
import { historicalCachePolicy, getTinybirdCachePolicy, tinybirdLogicalCacheKey } from "@/lib/tinybird-cache";
import { computeRecords, type GridRecords, type NesoHistoricRow } from "@/lib/historic-mix";
import { getLatestFacts, type LatestFacts } from "@/lib/facts";
import { peekWarmedPipe } from "@/lib/warm-envelope";
import type { CommodityPrice, EnergySnapshot, Generation5min } from "@/lib/types";

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

export async function peekLatestPrices(now = new Date()): Promise<CommodityPrice[] | null> {
  const range = "90d";
  const params = getPricesQueryParams(range, now);
  const policy = getTinybirdCachePolicy({
    pipeName: "prices_range",
    params,
    range,
    now,
  });
  return peekThroughCache<CommodityPrice[]>(
    tinybirdLogicalCacheKey({
      pipeName: "prices_range",
      range,
      params,
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

async function factsFromWarmedEnvelopes(now: Date): Promise<LatestFacts | null> {
  const range = "24h" as const;
  const [snapshots, generation] = await Promise.all([
    peekWarmedPipe<EnergySnapshot>("snapshots_range", getHeadlineSnapshotsQueryParams(now), {
      range,
      now,
    }),
    peekWarmedPipe<Generation5min>(
      "generation_5min_range",
      getHeadlineGenerationQueryParams(now),
      { range, now }
    ),
  ]);
  if (!snapshots || snapshots.length === 0) {
    return null;
  }
  const facts = getLatestFacts({
    resolution: resolveDashboardDate(null, now, range),
    snapshots,
    generation: generation ?? [],
    now,
  });
  return facts.empty ? null : facts;
}

export async function peekOgCacheSnapshot(now = new Date()): Promise<OgCacheSnapshot> {
  const [dashboard, prices, nesoRecords, envelopeFacts] = await Promise.all([
    peekLatestDashboardPayload(),
    peekLatestPrices(now),
    peekCachedGridRecords(now),
    factsFromWarmedEnvelopes(now),
  ]);
  const composed = dashboard?.facts && !dashboard.facts.empty ? dashboard.facts : null;

  return {
    facts: composed ?? envelopeFacts,
    records: dashboard?.records ?? nesoRecords,
    prices,
  };
}
