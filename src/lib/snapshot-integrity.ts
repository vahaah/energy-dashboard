import { getRedis } from "@/lib/redis-cache";
import type { EnergySnapshot } from "@/lib/types";
import { formatTinybirdDateTime } from "@/lib/london-time";

/** Nightly cron and /records use this; 1.25× leaves headroom for ~8 GW of exports. */
export const GENERATION_OVER_DEMAND_LIMIT = 1.25;

/** Diagnostic / confirmed-corrupt threshold from the 162-period scan. */
export const GENERATION_OVER_DEMAND_DIAGNOSTIC = 1.5;

export const GB_TOTAL_DEMAND_MAX_MW = 80_000;
export const CARBON_INTENSITY_MAX = 1_000;

/** Installed-capacity headroom above published GB records (wind ~23.9 GW, solar ~15.4 GW). */
export const GB_GENERATION_MAX_MW: Record<string, number> = {
  wind: 28_000,
  solar: 18_000,
  gas: 40_000,
  coal: 6_000,
  nuclear: 12_000,
  hydro: 6_000,
  biomass: 6_000,
  other: 10_000,
  oil: 4_000,
  pumped: 4_000,
  battery: 5_000,
};

export const SNAPSHOT_MW_FIELDS = [
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

export const SNAPSHOT_PCT_FIELDS = [
  "gen_gas_pct",
  "gen_coal_pct",
  "gen_nuclear_pct",
  "gen_wind_pct",
  "gen_solar_pct",
  "gen_hydro_pct",
  "gen_biomass_pct",
  "gen_imports_pct",
  "gen_other_pct",
] as const;

export const SNAPSHOT_INTEGRITY_REDIS_KEY = "grid:snapshot-integrity";

export type SnapshotIntegrityCode = "generation_vs_demand" | "fuel_maxima" | "out_of_bounds";

export type SnapshotIntegrityIssue = {
  code: SnapshotIntegrityCode;
  field: string;
  value: number;
  limit: number;
};

export type SnapshotIntegrityFinding = {
  timestamp: string;
  demandMw: number | null;
  generationMw: number | null;
  ratio: number | null;
  issues: SnapshotIntegrityIssue[];
};

export type SnapshotIntegrityReport = {
  checkedAt: string;
  settlementDate?: string;
  checkedTimestamps: string[];
  failing: SnapshotIntegrityFinding[];
};

export type StoredSnapshotIntegrity = {
  checkedAt: string;
  settlementDates: string[];
  failingTimestamps: string[];
};

export type SnapshotLike = EnergySnapshot | Record<string, unknown>;

export function integrityTimestampKey(value: string): string {
  return value.replace("T", " ").replace(/\.\d+Z?$/, "").replace(/Z$/, "").slice(0, 19);
}

export function normalizeTimestampSet(values: Iterable<string>): Set<string> {
  const keys = new Set<string>();
  for (const value of values) {
    const key = integrityTimestampKey(value);
    if (key.length >= 16) {
      keys.add(key);
    }
  }
  return keys;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function fuelFromSnapshotMwField(field: string): string {
  return field.replace(/^gen_/, "").replace(/_mw$/, "");
}

export function snapshotDomesticGenerationMw(row: SnapshotLike): number | null {
  let total = 0;
  let seen = false;
  for (const field of SNAPSHOT_MW_FIELDS) {
    const value = asFiniteNumber(row[field]);
    if (value == null) {
      continue;
    }
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

export function snapshotIntegrityIssues(
  row: SnapshotLike,
  rejectedGenTimes?: Set<string>
): SnapshotIntegrityIssue[] {
  const issues: SnapshotIntegrityIssue[] = [];
  const timestamp = typeof row.timestamp === "string" ? integrityTimestampKey(row.timestamp) : "";
  if (timestamp && rejectedGenTimes?.has(timestamp)) {
    issues.push({
      code: "fuel_maxima",
      field: "generation_mw",
      value: snapshotDomesticGenerationMw(row) ?? 0,
      limit: 0,
    });
  }

  const demand = asFiniteNumber(row.demand_mw);
  if (demand != null && (demand <= 0 || demand > GB_TOTAL_DEMAND_MAX_MW)) {
    issues.push({
      code: "out_of_bounds",
      field: "demand_mw",
      value: demand,
      limit: GB_TOTAL_DEMAND_MAX_MW,
    });
  }

  const carbon = asFiniteNumber(row.carbon_intensity);
  if (carbon != null && (carbon < 0 || carbon > CARBON_INTENSITY_MAX)) {
    issues.push({
      code: "out_of_bounds",
      field: "carbon_intensity",
      value: carbon,
      limit: CARBON_INTENSITY_MAX,
    });
  }

  for (const field of SNAPSHOT_PCT_FIELDS) {
    const value = asFiniteNumber(row[field]);
    if (value != null && (value < 0 || value > 100)) {
      issues.push({ code: "out_of_bounds", field, value, limit: 100 });
    }
  }

  for (const field of SNAPSHOT_MW_FIELDS) {
    const value = asFiniteNumber(row[field]);
    if (value == null) {
      continue;
    }
    const fuel = fuelFromSnapshotMwField(field);
    const maxMw = GB_GENERATION_MAX_MW[fuel];
    if (maxMw != null && value > maxMw) {
      issues.push({ code: "fuel_maxima", field, value, limit: maxMw });
    }
    if (fuel !== "pumped" && fuel !== "battery" && value < 0) {
      issues.push({ code: "out_of_bounds", field, value, limit: 0 });
    }
  }

  const generation = snapshotDomesticGenerationMw(row);
  if (
    demand != null &&
    demand > 0 &&
    generation != null &&
    generation > demand * GENERATION_OVER_DEMAND_LIMIT
  ) {
    issues.push({
      code: "generation_vs_demand",
      field: "generation_mw",
      value: generation,
      limit: demand * GENERATION_OVER_DEMAND_LIMIT,
    });
  }

  return issues;
}

export function findingFromSnapshotRow(
  row: SnapshotLike,
  issues: SnapshotIntegrityIssue[]
): SnapshotIntegrityFinding {
  const demandMw = asFiniteNumber(row.demand_mw);
  const generationMw = snapshotDomesticGenerationMw(row);
  return {
    timestamp: typeof row.timestamp === "string" ? integrityTimestampKey(row.timestamp) : "",
    demandMw,
    generationMw,
    ratio: demandMw != null && demandMw > 0 && generationMw != null ? generationMw / demandMw : null,
    issues,
  };
}

export function inspectSnapshotRows(
  rows: SnapshotLike[],
  options?: { settlementDate?: string; now?: Date; rejectedGenTimes?: Set<string> }
): SnapshotIntegrityReport {
  const failing: SnapshotIntegrityFinding[] = [];
  const checkedTimestamps: string[] = [];

  for (const row of rows) {
    const timestamp = typeof row.timestamp === "string" ? integrityTimestampKey(row.timestamp) : "";
    if (timestamp) {
      checkedTimestamps.push(timestamp);
    }
    const issues = snapshotIntegrityIssues(row, options?.rejectedGenTimes);
    if (issues.length > 0) {
      failing.push(findingFromSnapshotRow(row, issues));
    }
  }

  return {
    checkedAt: formatTinybirdDateTime(options?.now ?? new Date()),
    settlementDate: options?.settlementDate,
    checkedTimestamps,
    failing,
  };
}

export function snapshotRowFailsIntegrity(
  row: SnapshotLike,
  rejectedGenTimes?: Set<string>
): boolean {
  return snapshotIntegrityIssues(row, rejectedGenTimes).length > 0;
}

export function emptyIntegrityReport(
  now = new Date(),
  settlementDate?: string
): SnapshotIntegrityReport {
  return {
    checkedAt: formatTinybirdDateTime(now),
    settlementDate,
    checkedTimestamps: [],
    failing: [],
  };
}

export function integritySourceStatus(report: SnapshotIntegrityReport): {
  source: string;
  ok: boolean;
  rows: number;
  error?: string;
} {
  if (report.failing.length === 0) {
    return { source: "snapshot_integrity", ok: true, rows: report.checkedTimestamps.length };
  }
  return {
    source: "snapshot_integrity",
    ok: false,
    rows: report.failing.length,
    error: `${report.failing.length} half-hours failed generation/demand or bounds checks`,
  };
}

export function mergeStoredIntegrity(
  existing: StoredSnapshotIntegrity | null,
  report: SnapshotIntegrityReport
): StoredSnapshotIntegrity {
  const failing = new Set(existing?.failingTimestamps ?? []);
  for (const timestamp of report.checkedTimestamps) {
    failing.delete(integrityTimestampKey(timestamp));
  }
  for (const finding of report.failing) {
    failing.add(integrityTimestampKey(finding.timestamp));
  }

  const settlementDates = new Set(existing?.settlementDates ?? []);
  if (report.settlementDate) {
    settlementDates.add(report.settlementDate);
  }

  return {
    checkedAt: report.checkedAt,
    settlementDates: [...settlementDates].sort(),
    failingTimestamps: [...failing].sort(),
  };
}

function parseStoredIntegrity(value: StoredSnapshotIntegrity | string | null): StoredSnapshotIntegrity | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as StoredSnapshotIntegrity;
  }
  return value;
}

export async function readSnapshotIntegrity(): Promise<StoredSnapshotIntegrity | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }
  return parseStoredIntegrity(
    await redis.get<StoredSnapshotIntegrity | string>(SNAPSHOT_INTEGRITY_REDIS_KEY)
  );
}

export async function recordSnapshotIntegrity(report: SnapshotIntegrityReport): Promise<StoredSnapshotIntegrity> {
  const merged = mergeStoredIntegrity(await readSnapshotIntegrity(), report);
  const redis = getRedis();
  if (!redis) {
    return merged;
  }
  await redis.set(SNAPSHOT_INTEGRITY_REDIS_KEY, JSON.stringify(merged));
  return merged;
}

/**
 * One Tinybird SQL statement: inflated energy_snapshots vs half-hourly FUELINST.
 * Do not issue this from cron — scripts only, one request per run.
 */
export function inflatedSnapshotSql(): string {
  const generationExpr = SNAPSHOT_MW_FIELDS.map((field) => `ifNull(${field}, 0)`).join(" + ");
  return `
WITH snaps AS (
  SELECT
    timestamp,
    demand_mw,
    carbon_intensity,
    gen_gas_mw,
    gen_coal_mw,
    gen_nuclear_mw,
    gen_wind_mw,
    gen_solar_mw,
    gen_hydro_mw,
    gen_biomass_mw,
    gen_other_mw,
    gen_pumped_mw,
    gen_battery_mw,
    ${generationExpr} AS generation_mw
  FROM energy_snapshots FINAL
  WHERE demand_mw > 0
    AND (${generationExpr}) > ${GENERATION_OVER_DEMAND_DIAGNOSTIC} * demand_mw
),
fuelinst AS (
  SELECT
    toStartOfInterval(timestamp, INTERVAL 30 minute) AS period,
    avgIf(generation_mw, fuel_type IN ('ccgt', 'ocgt')) AS fuelinst_gas_mw,
    avgIf(generation_mw, fuel_type = 'coal') AS fuelinst_coal_mw,
    avgIf(generation_mw, fuel_type = 'nuclear') AS fuelinst_nuclear_mw,
    avgIf(generation_mw, fuel_type = 'wind') AS fuelinst_wind_mw,
    avgIf(generation_mw, fuel_type = 'solar') AS fuelinst_solar_mw,
    avgIf(generation_mw, fuel_type = 'npshyd') AS fuelinst_hydro_mw,
    avgIf(generation_mw, fuel_type = 'biomass') AS fuelinst_biomass_mw,
    avgIf(generation_mw, fuel_type IN ('other', 'oil')) AS fuelinst_other_mw,
    avgIf(generation_mw, fuel_type = 'ps') AS fuelinst_pumped_mw
  FROM generation_5min FINAL
  WHERE source = 'fuelinst'
    AND toStartOfInterval(timestamp, INTERVAL 30 minute) IN (SELECT timestamp FROM snaps)
  GROUP BY period
)
SELECT
  s.timestamp,
  s.demand_mw,
  s.generation_mw,
  s.generation_mw / s.demand_mw AS ratio,
  s.carbon_intensity,
  s.gen_gas_mw,
  s.gen_coal_mw,
  s.gen_nuclear_mw,
  s.gen_wind_mw,
  s.gen_solar_mw,
  s.gen_hydro_mw,
  s.gen_biomass_mw,
  s.gen_other_mw,
  s.gen_pumped_mw,
  s.gen_battery_mw,
  f.fuelinst_gas_mw,
  f.fuelinst_coal_mw,
  f.fuelinst_nuclear_mw,
  f.fuelinst_wind_mw,
  f.fuelinst_solar_mw,
  f.fuelinst_hydro_mw,
  f.fuelinst_biomass_mw,
  f.fuelinst_other_mw,
  f.fuelinst_pumped_mw,
  if(s.gen_gas_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_gas_mw AND f.fuelinst_gas_mw > 0, 1, 0) AS gas_inflated,
  if(s.gen_coal_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_coal_mw AND f.fuelinst_coal_mw > 0, 1, 0) AS coal_inflated,
  if(s.gen_nuclear_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_nuclear_mw AND f.fuelinst_nuclear_mw > 0, 1, 0) AS nuclear_inflated,
  if(s.gen_wind_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_wind_mw AND f.fuelinst_wind_mw > 0, 1, 0) AS wind_inflated,
  if(s.gen_solar_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_solar_mw AND f.fuelinst_solar_mw > 0, 1, 0) AS solar_inflated,
  if(s.gen_hydro_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_hydro_mw AND f.fuelinst_hydro_mw > 0, 1, 0) AS hydro_inflated,
  if(s.gen_biomass_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_biomass_mw AND f.fuelinst_biomass_mw > 0, 1, 0) AS biomass_inflated,
  if(s.gen_other_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_other_mw AND f.fuelinst_other_mw > 0, 1, 0) AS other_inflated,
  if(s.gen_pumped_mw > ${GENERATION_OVER_DEMAND_LIMIT} * f.fuelinst_pumped_mw AND f.fuelinst_pumped_mw > 0, 1, 0) AS pumped_inflated
FROM snaps AS s
LEFT JOIN fuelinst AS f ON f.period = s.timestamp
ORDER BY s.timestamp
`.trim();
}

export type InflatedSnapshotRow = {
  timestamp: string;
  demand_mw: number;
  generation_mw: number;
  ratio: number;
  carbon_intensity: number | null;
  gen_gas_mw: number | null;
  gen_coal_mw: number | null;
  gen_nuclear_mw: number | null;
  gen_wind_mw: number | null;
  gen_solar_mw: number | null;
  gen_hydro_mw: number | null;
  gen_biomass_mw: number | null;
  gen_other_mw: number | null;
  gen_pumped_mw: number | null;
  gen_battery_mw: number | null;
  fuelinst_gas_mw: number | null;
  fuelinst_coal_mw: number | null;
  fuelinst_nuclear_mw: number | null;
  fuelinst_wind_mw: number | null;
  fuelinst_solar_mw: number | null;
  fuelinst_hydro_mw: number | null;
  fuelinst_biomass_mw: number | null;
  fuelinst_other_mw: number | null;
  fuelinst_pumped_mw: number | null;
  gas_inflated: number;
  coal_inflated: number;
  nuclear_inflated: number;
  wind_inflated: number;
  solar_inflated: number;
  hydro_inflated: number;
  biomass_inflated: number;
  other_inflated: number;
  pumped_inflated: number;
};

export const INFLATED_FUEL_FLAGS = [
  "gas",
  "coal",
  "nuclear",
  "wind",
  "solar",
  "hydro",
  "biomass",
  "other",
  "pumped",
] as const;

export function inflatedFuelsForRow(row: InflatedSnapshotRow): string[] {
  const fuels: string[] = [];
  for (const fuel of INFLATED_FUEL_FLAGS) {
    if (row[`${fuel}_inflated`] === 1) {
      fuels.push(fuel);
    }
  }
  return fuels;
}

export function inflatedSnapshotFromWideRow(row: SnapshotLike): InflatedSnapshotRow | null {
  const demand = typeof row.demand_mw === "number" ? row.demand_mw : null;
  const generation = snapshotDomesticGenerationMw(row);
  if (demand == null || demand <= 0 || generation == null) {
    return null;
  }
  if (generation <= demand * GENERATION_OVER_DEMAND_DIAGNOSTIC) {
    return null;
  }
  const mw = (field: (typeof SNAPSHOT_MW_FIELDS)[number]): number | null => {
    const value = row[field];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  return {
    timestamp: typeof row.timestamp === "string" ? integrityTimestampKey(row.timestamp) : "",
    demand_mw: demand,
    generation_mw: generation,
    ratio: generation / demand,
    carbon_intensity: typeof row.carbon_intensity === "number" ? row.carbon_intensity : null,
    gen_gas_mw: mw("gen_gas_mw"),
    gen_coal_mw: mw("gen_coal_mw"),
    gen_nuclear_mw: mw("gen_nuclear_mw"),
    gen_wind_mw: mw("gen_wind_mw"),
    gen_solar_mw: mw("gen_solar_mw"),
    gen_hydro_mw: mw("gen_hydro_mw"),
    gen_biomass_mw: mw("gen_biomass_mw"),
    gen_other_mw: mw("gen_other_mw"),
    gen_pumped_mw: mw("gen_pumped_mw"),
    gen_battery_mw: mw("gen_battery_mw"),
    fuelinst_gas_mw: null,
    fuelinst_coal_mw: null,
    fuelinst_nuclear_mw: null,
    fuelinst_wind_mw: null,
    fuelinst_solar_mw: null,
    fuelinst_hydro_mw: null,
    fuelinst_biomass_mw: null,
    fuelinst_other_mw: null,
    fuelinst_pumped_mw: null,
    gas_inflated: 0,
    coal_inflated: 0,
    nuclear_inflated: 0,
    wind_inflated: 0,
    solar_inflated: 0,
    hydro_inflated: 0,
    biomass_inflated: 0,
    other_inflated: 0,
    pumped_inflated: 0,
  };
}
