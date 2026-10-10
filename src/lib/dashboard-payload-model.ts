import type { CommodityPrice, CommodityRange, EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";
import type { DashboardDateResolution } from "@/lib/dashboard-search-params";
import { isNesoPeriod, type DashboardPeriod } from "@/lib/dashboard-period";
import type { LatestFacts } from "@/lib/facts";
import type { PublicLookAhead } from "@/lib/forecast-model";
import type { GridRecords, HistoricPeriodView } from "@/lib/historic-mix";
import { historicalCachePolicy, liveCachePolicy } from "@/lib/tinybird-cache";

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
  lookAhead: PublicLookAhead | null;
};

export function dashboardPayloadCacheKey(
  period: DashboardPeriod,
  date: string | null,
  commodityRange: CommodityRange
): string {
  return `dashboard:${period}:${date ?? ""}:${commodityRange}`;
}

export function dashboardPayloadCacheDate(
  resolution: DashboardDateResolution,
  requested: string | null
): string | null {
  if (resolution.status === "latest") {
    return null;
  }
  return requested ?? resolution.date;
}

export function dashboardPayloadPolicy(period: DashboardPeriod) {
  return isNesoPeriod(period) ? historicalCachePolicy() : liveCachePolicy();
}

export function compactHistoricPayload(payload: DashboardPayload): DashboardPayload {
  if (!payload.historicView) {
    return payload;
  }

  return {
    ...payload,
    snapshots: [],
    headlineSnapshots: [],
    generationHistory: [],
    headlineGeneration: [],
    transitionView: payload.period === "all" ? null : payload.transitionView,
    prices: [],
  };
}

export function hydrateDashboardPayload(payload: DashboardPayload): DashboardPayload {
  const historic = payload.historicView;
  if (!historic) {
    return payload;
  }

  return {
    ...payload,
    snapshots: payload.snapshots.length > 0 ? payload.snapshots : historic.snapshots,
    headlineSnapshots:
      payload.headlineSnapshots.length > 0 ? payload.headlineSnapshots : historic.snapshots,
    generationHistory:
      payload.generationHistory.length > 0 ? payload.generationHistory : historic.generation,
    headlineGeneration:
      payload.headlineGeneration.length > 0 ? payload.headlineGeneration : historic.generation,
    transitionView: payload.transitionView ?? historic,
  };
}
