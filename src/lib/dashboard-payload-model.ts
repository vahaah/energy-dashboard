import type { CommodityPrice, EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";
import type { DashboardDateResolution } from "@/lib/dashboard-search-params";
import { isNesoPeriod, type DashboardPeriod } from "@/lib/dashboard-period";
import type { LatestFacts } from "@/lib/facts";
import type { PublicLookAhead } from "@/lib/forecast-model";
import type { GridRecords, HistoricPeriodView } from "@/lib/historic-mix";
import {
  formatTinybirdDateTime,
  getLondonDateTimeParts,
  parseUtcDateTime,
} from "@/lib/london-time";
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

export const HEADLINE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const WEEK_GENERATION_BUCKET_MS = 60 * 60 * 1000;

export function dashboardPayloadCacheKey(
  period: DashboardPeriod,
  date: string | null
): string {
  return `dashboard:${period}:${date ?? ""}`;
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

export function headlineWindow<T extends { timestamp: string }>(rows: T[]): T[] {
  if (rows.length === 0) {
    return [];
  }

  let latest = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const ms = parseUtcDateTime(row.timestamp).getTime();
    if (ms > latest) {
      latest = ms;
    }
  }

  const start = latest - HEADLINE_WINDOW_MS;
  return rows.filter((row) => parseUtcDateTime(row.timestamp).getTime() >= start);
}

export function compactDashboardPayload(payload: DashboardPayload): DashboardPayload {
  const historic = compactHistoricPayload(payload);
  return {
    ...historic,
    prices: [],
    snapshots: historic.snapshots,
    generationHistory: downsampleGeneration(historic.generationHistory, payload.period),
    headlineSnapshots: [],
    headlineGeneration: [],
    transitionView: slimTransitionView(historic.transitionView),
    historicView: downsampleHistoricView(historic.historicView, payload.period),
  };
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
  const snapshots =
    payload.snapshots.length > 0 ? payload.snapshots : (historic?.snapshots ?? []);
  const generationHistory =
    payload.generationHistory.length > 0
      ? payload.generationHistory
      : (historic?.generation ?? []);

  return {
    ...payload,
    snapshots,
    headlineSnapshots:
      payload.headlineSnapshots.length > 0
        ? payload.headlineSnapshots
        : headlineWindow(snapshots),
    generationHistory,
    headlineGeneration:
      payload.headlineGeneration.length > 0
        ? payload.headlineGeneration
        : headlineWindow(generationHistory),
    transitionView: payload.transitionView ?? historic ?? null,
  };
}

export function downsampleGeneration(
  rows: Generation5min[],
  period: DashboardPeriod
): Generation5min[] {
  switch (period) {
    case "day":
      return rows;
    case "week":
      return bucketGeneration(rows, WEEK_GENERATION_BUCKET_MS);
    case "year":
    case "all":
      return rows;
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

export function downsampleHistoricView(
  view: HistoricPeriodView | null,
  period: DashboardPeriod
): HistoricPeriodView | null {
  if (!view) {
    return null;
  }

  switch (period) {
    case "day":
    case "week":
    case "year":
      return view;
    case "all":
      return {
        ...view,
        snapshots: bucketSnapshotsByMonth(view.snapshots),
        generation: bucketGenerationByMonth(view.generation),
      };
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

export function slimTransitionView(
  view: HistoricPeriodView | null
): HistoricPeriodView | null {
  if (!view) {
    return null;
  }

  return {
    snapshots: [],
    generation: [],
    averageRows: [],
    averages: view.averages,
    yearly: view.yearly,
    sentences: view.sentences,
  };
}

export function payloadJsonBytes(payload: DashboardPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

function bucketGeneration(rows: Generation5min[], bucketMs: number): Generation5min[] {
  const groups = new Map<
    string,
    { sum: number; count: number; row: Generation5min; time: number }
  >();

  for (const row of rows) {
    const ms = parseUtcDateTime(row.timestamp).getTime();
    const bucket = Math.floor(ms / bucketMs) * bucketMs;
    const key = `${bucket}|${row.fuel_type}|${row.source}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sum: row.generation_mw,
        count: 1,
        time: bucket,
        row: {
          ...row,
          timestamp: formatTinybirdDateTime(new Date(bucket)),
        },
      });
      continue;
    }
    existing.sum += row.generation_mw;
    existing.count += 1;
  }

  return [...groups.values()]
    .sort((left, right) => left.time - right.time || left.row.fuel_type.localeCompare(right.row.fuel_type))
    .map((group) => ({
      ...group.row,
      generation_mw: group.sum / group.count,
    }));
}

function bucketGenerationByMonth(rows: Generation5min[]): Generation5min[] {
  const groups = new Map<
    string,
    { sum: number; count: number; row: Generation5min; time: number }
  >();

  for (const row of rows) {
    const date = parseUtcDateTime(row.timestamp);
    const monthStart = utcMonthStart(date);
    const key = `${monthStart}|${row.fuel_type}|${row.source}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sum: row.generation_mw,
        count: 1,
        time: monthStart,
        row: {
          ...row,
          timestamp: formatTinybirdDateTime(new Date(monthStart)),
        },
      });
      continue;
    }
    existing.sum += row.generation_mw;
    existing.count += 1;
  }

  return [...groups.values()]
    .sort((left, right) => left.time - right.time || left.row.fuel_type.localeCompare(right.row.fuel_type))
    .map((group) => ({
      ...group.row,
      generation_mw: group.sum / group.count,
    }));
}

function bucketSnapshotsByMonth(snapshots: EnergySnapshot[]): EnergySnapshot[] {
  const groups = new Map<
    string,
    { sum: EnergySnapshot; count: number; time: number }
  >();

  for (const snapshot of snapshots) {
    const date = parseUtcDateTime(snapshot.timestamp);
    const monthStart = utcMonthStart(date);
    const key = String(monthStart);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sum: { ...snapshot, timestamp: formatTinybirdDateTime(new Date(monthStart)) },
        count: 1,
        time: monthStart,
      });
      continue;
    }
    existing.sum = addSnapshots(existing.sum, snapshot);
    existing.count += 1;
  }

  return [...groups.values()]
    .sort((left, right) => left.time - right.time)
    .map((group) => averageSnapshot(group.sum, group.count, group.time));
}

function utcMonthStart(date: Date): number {
  const parts = getLondonDateTimeParts(date);
  return Date.UTC(parts.year, parts.month - 1, 1);
}

function addSnapshots(left: EnergySnapshot, right: EnergySnapshot): EnergySnapshot {
  return {
    timestamp: left.timestamp,
    carbon_intensity: addNullable(left.carbon_intensity, right.carbon_intensity),
    carbon_forecast: addNullable(left.carbon_forecast, right.carbon_forecast),
    carbon_index: left.carbon_index,
    demand_mw: addNullable(left.demand_mw, right.demand_mw),
    price_gbp_mwh: addNullable(left.price_gbp_mwh, right.price_gbp_mwh),
    price_mid_gbp_mwh: addNullable(left.price_mid_gbp_mwh, right.price_mid_gbp_mwh),
    mid_volume_mwh: addNullable(left.mid_volume_mwh, right.mid_volume_mwh),
    gen_gas_pct: addNullable(left.gen_gas_pct, right.gen_gas_pct),
    gen_coal_pct: addNullable(left.gen_coal_pct, right.gen_coal_pct),
    gen_nuclear_pct: addNullable(left.gen_nuclear_pct, right.gen_nuclear_pct),
    gen_wind_pct: addNullable(left.gen_wind_pct, right.gen_wind_pct),
    gen_solar_pct: addNullable(left.gen_solar_pct, right.gen_solar_pct),
    gen_hydro_pct: addNullable(left.gen_hydro_pct, right.gen_hydro_pct),
    gen_biomass_pct: addNullable(left.gen_biomass_pct, right.gen_biomass_pct),
    gen_imports_pct: addNullable(left.gen_imports_pct, right.gen_imports_pct),
    gen_other_pct: addNullable(left.gen_other_pct, right.gen_other_pct),
    gen_gas_mw: addNullable(left.gen_gas_mw, right.gen_gas_mw),
    gen_coal_mw: addNullable(left.gen_coal_mw, right.gen_coal_mw),
    gen_nuclear_mw: addNullable(left.gen_nuclear_mw, right.gen_nuclear_mw),
    gen_wind_mw: addNullable(left.gen_wind_mw, right.gen_wind_mw),
    gen_solar_mw: addNullable(left.gen_solar_mw, right.gen_solar_mw),
    gen_hydro_mw: addNullable(left.gen_hydro_mw, right.gen_hydro_mw),
    gen_biomass_mw: addNullable(left.gen_biomass_mw, right.gen_biomass_mw),
    gen_other_mw: addNullable(left.gen_other_mw, right.gen_other_mw),
    gen_pumped_mw: addNullable(left.gen_pumped_mw, right.gen_pumped_mw),
    gen_battery_mw: addNullable(left.gen_battery_mw, right.gen_battery_mw),
  };
}

function averageSnapshot(sum: EnergySnapshot, count: number, time: number): EnergySnapshot {
  return {
    ...sum,
    timestamp: formatTinybirdDateTime(new Date(time)),
    carbon_intensity: divideNullable(sum.carbon_intensity, count),
    carbon_forecast: divideNullable(sum.carbon_forecast, count),
    demand_mw: divideNullable(sum.demand_mw, count),
    price_gbp_mwh: divideNullable(sum.price_gbp_mwh, count),
    price_mid_gbp_mwh: divideNullable(sum.price_mid_gbp_mwh, count),
    mid_volume_mwh: divideNullable(sum.mid_volume_mwh, count),
    gen_gas_pct: divideNullable(sum.gen_gas_pct, count),
    gen_coal_pct: divideNullable(sum.gen_coal_pct, count),
    gen_nuclear_pct: divideNullable(sum.gen_nuclear_pct, count),
    gen_wind_pct: divideNullable(sum.gen_wind_pct, count),
    gen_solar_pct: divideNullable(sum.gen_solar_pct, count),
    gen_hydro_pct: divideNullable(sum.gen_hydro_pct, count),
    gen_biomass_pct: divideNullable(sum.gen_biomass_pct, count),
    gen_imports_pct: divideNullable(sum.gen_imports_pct, count),
    gen_other_pct: divideNullable(sum.gen_other_pct, count),
    gen_gas_mw: divideNullable(sum.gen_gas_mw, count),
    gen_coal_mw: divideNullable(sum.gen_coal_mw, count),
    gen_nuclear_mw: divideNullable(sum.gen_nuclear_mw, count),
    gen_wind_mw: divideNullable(sum.gen_wind_mw, count),
    gen_solar_mw: divideNullable(sum.gen_solar_mw, count),
    gen_hydro_mw: divideNullable(sum.gen_hydro_mw, count),
    gen_biomass_mw: divideNullable(sum.gen_biomass_mw, count),
    gen_other_mw: divideNullable(sum.gen_other_mw, count),
    gen_pumped_mw: divideNullable(sum.gen_pumped_mw, count),
    gen_battery_mw: divideNullable(sum.gen_battery_mw, count),
  };
}

function addNullable(left: number | null | undefined, right: number | null | undefined): number | null {
  if (left == null && right == null) {
    return null;
  }
  return (left ?? 0) + (right ?? 0);
}

function divideNullable(value: number | null | undefined, count: number): number | null {
  if (value == null || count === 0) {
    return null;
  }
  return value / count;
}
