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
export const WEEK_GENERATION_BUCKET_MS = 3 * 60 * 60 * 1000;
export const WEEK_SNAPSHOT_BUCKET_MS = 60 * 60 * 1000;
export const FACTS_GENERATION_FRAMES = 2;
export const EMBEDDED_FACTS_KEEP_MS = 90 * 60 * 1000;

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
    facts: slimFactsForClient(historic.facts),
    snapshots: downsampleSnapshots(historic.snapshots, payload.period),
    generationHistory: downsampleGeneration(historic.generationHistory, payload.period),
    headlineSnapshots: compactHeadlineSnapshots(payload),
    headlineGeneration: [],
    transitionView: slimTransitionView(historic.transitionView),
    historicView: downsampleHistoricView(historic.historicView, payload.period),
  };
}

export function slimFactsForClient(facts: LatestFacts): LatestFacts {
  if (!facts.generationRows || facts.generationRows.length === 0) {
    return facts;
  }

  return {
    ...facts,
    generationRows: slimGenerationRows(facts.generationRows),
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

export function downsampleSnapshots(
  snapshots: EnergySnapshot[],
  period: DashboardPeriod
): EnergySnapshot[] {
  switch (period) {
    case "day":
      return snapshots;
    case "week":
      return bucketSnapshotsByMs(snapshots, WEEK_SNAPSHOT_BUCKET_MS);
    case "year":
    case "all":
      return snapshots;
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

function compactHeadlineSnapshots(payload: DashboardPayload): EnergySnapshot[] {
  switch (payload.period) {
    case "week":
      return headlineWindow(payload.snapshots);
    case "day":
    case "year":
    case "all":
      return [];
    default: {
      const exhaustive: never = payload.period;
      return exhaustive;
    }
  }
}

function slimGenerationRows(rows: Generation5min[]): Generation5min[] {
  const fuelinstTimes = new Set<number>();
  let latestAny = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const ms = parseUtcDateTime(row.timestamp).getTime();
    if (ms > latestAny) {
      latestAny = ms;
    }
    if (row.source === "fuelinst") {
      fuelinstTimes.add(ms);
    }
  }

  const keptFuelinst = [...fuelinstTimes].sort((left, right) => left - right).slice(-FACTS_GENERATION_FRAMES);
  if (keptFuelinst.length === 0) {
    if (!Number.isFinite(latestAny)) {
      return [];
    }
    const start = latestAny - EMBEDDED_FACTS_KEEP_MS;
    return rows.filter((row) => parseUtcDateTime(row.timestamp).getTime() >= start);
  }

  const minKept = keptFuelinst[0];
  const maxKept = keptFuelinst[keptFuelinst.length - 1];
  const kept = new Set(keptFuelinst);

  return rows.filter((row) => {
    const ms = parseUtcDateTime(row.timestamp).getTime();
    if (row.source === "fuelinst") {
      return kept.has(ms);
    }
    return ms <= maxKept + 5 * 60 * 1000 && ms >= minKept - EMBEDDED_FACTS_KEEP_MS;
  });
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

const SNAPSHOT_AVERAGE_FIELDS = [
  "carbon_intensity",
  "carbon_forecast",
  "demand_mw",
  "price_gbp_mwh",
  "price_mid_gbp_mwh",
  "mid_volume_mwh",
  "gen_gas_pct",
  "gen_coal_pct",
  "gen_nuclear_pct",
  "gen_wind_pct",
  "gen_solar_pct",
  "gen_hydro_pct",
  "gen_biomass_pct",
  "gen_imports_pct",
  "gen_other_pct",
  "gen_gas_mw",
  "gen_coal_mw",
  "gen_nuclear_mw",
  "gen_wind_mw",
  "gen_solar_mw",
  "gen_hydro_mw",
  "gen_biomass_mw",
  "gen_other_mw",
  "gen_pumped_mw",
  "gen_battery_mw",
] as const;

type SnapshotAverageField = (typeof SNAPSHOT_AVERAGE_FIELDS)[number];
type SnapshotFieldCounts = Record<SnapshotAverageField, number>;

function bucketSnapshotsByMs(snapshots: EnergySnapshot[], bucketMs: number): EnergySnapshot[] {
  const groups = new Map<
    string,
    { sum: EnergySnapshot; counts: SnapshotFieldCounts; time: number }
  >();

  for (const snapshot of snapshots) {
    const ms = parseUtcDateTime(snapshot.timestamp).getTime();
    const bucket = Math.floor(ms / bucketMs) * bucketMs;
    const key = String(bucket);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sum: { ...snapshot, timestamp: formatTinybirdDateTime(new Date(bucket)) },
        counts: snapshotFieldCounts(snapshot),
        time: bucket,
      });
      continue;
    }
    existing.sum = addSnapshots(existing.sum, snapshot);
    existing.counts = addSnapshotFieldCounts(existing.counts, snapshot);
  }

  return [...groups.values()]
    .sort((left, right) => left.time - right.time)
    .map((group) => averageSnapshot(group.sum, group.counts, group.time));
}

function bucketSnapshotsByMonth(snapshots: EnergySnapshot[]): EnergySnapshot[] {
  const groups = new Map<
    string,
    { sum: EnergySnapshot; counts: SnapshotFieldCounts; time: number }
  >();

  for (const snapshot of snapshots) {
    const date = parseUtcDateTime(snapshot.timestamp);
    const monthStart = utcMonthStart(date);
    const key = String(monthStart);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        sum: { ...snapshot, timestamp: formatTinybirdDateTime(new Date(monthStart)) },
        counts: snapshotFieldCounts(snapshot),
        time: monthStart,
      });
      continue;
    }
    existing.sum = addSnapshots(existing.sum, snapshot);
    existing.counts = addSnapshotFieldCounts(existing.counts, snapshot);
  }

  return [...groups.values()]
    .sort((left, right) => left.time - right.time)
    .map((group) => averageSnapshot(group.sum, group.counts, group.time));
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

function averageSnapshot(
  sum: EnergySnapshot,
  counts: SnapshotFieldCounts,
  time: number
): EnergySnapshot {
  return {
    ...sum,
    timestamp: formatTinybirdDateTime(new Date(time)),
    carbon_intensity: divideNullable(sum.carbon_intensity, counts.carbon_intensity),
    carbon_forecast: divideNullable(sum.carbon_forecast, counts.carbon_forecast),
    demand_mw: divideNullable(sum.demand_mw, counts.demand_mw),
    price_gbp_mwh: divideNullable(sum.price_gbp_mwh, counts.price_gbp_mwh),
    price_mid_gbp_mwh: divideNullable(sum.price_mid_gbp_mwh, counts.price_mid_gbp_mwh),
    mid_volume_mwh: divideNullable(sum.mid_volume_mwh, counts.mid_volume_mwh),
    gen_gas_pct: divideNullable(sum.gen_gas_pct, counts.gen_gas_pct),
    gen_coal_pct: divideNullable(sum.gen_coal_pct, counts.gen_coal_pct),
    gen_nuclear_pct: divideNullable(sum.gen_nuclear_pct, counts.gen_nuclear_pct),
    gen_wind_pct: divideNullable(sum.gen_wind_pct, counts.gen_wind_pct),
    gen_solar_pct: divideNullable(sum.gen_solar_pct, counts.gen_solar_pct),
    gen_hydro_pct: divideNullable(sum.gen_hydro_pct, counts.gen_hydro_pct),
    gen_biomass_pct: divideNullable(sum.gen_biomass_pct, counts.gen_biomass_pct),
    gen_imports_pct: divideNullable(sum.gen_imports_pct, counts.gen_imports_pct),
    gen_other_pct: divideNullable(sum.gen_other_pct, counts.gen_other_pct),
    gen_gas_mw: divideNullable(sum.gen_gas_mw, counts.gen_gas_mw),
    gen_coal_mw: divideNullable(sum.gen_coal_mw, counts.gen_coal_mw),
    gen_nuclear_mw: divideNullable(sum.gen_nuclear_mw, counts.gen_nuclear_mw),
    gen_wind_mw: divideNullable(sum.gen_wind_mw, counts.gen_wind_mw),
    gen_solar_mw: divideNullable(sum.gen_solar_mw, counts.gen_solar_mw),
    gen_hydro_mw: divideNullable(sum.gen_hydro_mw, counts.gen_hydro_mw),
    gen_biomass_mw: divideNullable(sum.gen_biomass_mw, counts.gen_biomass_mw),
    gen_other_mw: divideNullable(sum.gen_other_mw, counts.gen_other_mw),
    gen_pumped_mw: divideNullable(sum.gen_pumped_mw, counts.gen_pumped_mw),
    gen_battery_mw: divideNullable(sum.gen_battery_mw, counts.gen_battery_mw),
  };
}

function snapshotFieldCounts(snapshot: EnergySnapshot): SnapshotFieldCounts {
  return addSnapshotFieldCounts(emptySnapshotFieldCounts(), snapshot);
}

function addSnapshotFieldCounts(
  counts: SnapshotFieldCounts,
  snapshot: EnergySnapshot
): SnapshotFieldCounts {
  const next = { ...counts };
  for (const field of SNAPSHOT_AVERAGE_FIELDS) {
    if (snapshot[field] != null) {
      next[field] += 1;
    }
  }
  return next;
}

function emptySnapshotFieldCounts(): SnapshotFieldCounts {
  return {
    carbon_intensity: 0,
    carbon_forecast: 0,
    demand_mw: 0,
    price_gbp_mwh: 0,
    price_mid_gbp_mwh: 0,
    mid_volume_mwh: 0,
    gen_gas_pct: 0,
    gen_coal_pct: 0,
    gen_nuclear_pct: 0,
    gen_wind_pct: 0,
    gen_solar_pct: 0,
    gen_hydro_pct: 0,
    gen_biomass_pct: 0,
    gen_imports_pct: 0,
    gen_other_pct: 0,
    gen_gas_mw: 0,
    gen_coal_mw: 0,
    gen_nuclear_mw: 0,
    gen_wind_mw: 0,
    gen_solar_mw: 0,
    gen_hydro_mw: 0,
    gen_biomass_mw: 0,
    gen_other_mw: 0,
    gen_pumped_mw: 0,
    gen_battery_mw: 0,
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
