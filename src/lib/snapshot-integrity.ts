import { getRedis } from "@/lib/redis-cache";
import type { EnergySnapshot } from "@/lib/types";
import { formatTinybirdDateTime } from "@/lib/london-time";

/** Per-fuel snapshot vs FUELINST inflation flag in the diagnostic SQL. */
export const GENERATION_OVER_DEMAND_LIMIT = 1.25;

/** Always-on slack for measurement mismatch on a like-for-like basis. */
export const SNAPSHOT_BALANCE_TOLERANCE = 0.15;

/**
 * Extra headroom when `gen_imports_pct` is missing or low. Snapshots store no
 * export MW, and sunny half-hours are often net exporters.
 */
export const SNAPSHOT_EXPORT_HEADROOM = 0.25;

export const LOW_IMPORT_SHARE_PCT = 10;

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

export type SnapshotIntegrityCode = "balance" | "fuel_maxima" | "out_of_bounds";
export type SnapshotIntegritySeverity = "hard" | "soft";

export type SnapshotIntegrityIssue = {
  code: SnapshotIntegrityCode;
  field: string;
  value: number;
  limit: number;
};

export function issueSeverity(code: SnapshotIntegrityCode): SnapshotIntegritySeverity {
  switch (code) {
    case "balance":
      return "soft";
    case "fuel_maxima":
    case "out_of_bounds":
      return "hard";
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

export function findingHasHardIssue(finding: SnapshotIntegrityFinding): boolean {
  return finding.issues.some((issue) => issueSeverity(issue.code) === "hard");
}

export function findingHasOnlySoftIssues(finding: SnapshotIntegrityFinding): boolean {
  return finding.issues.length > 0 && !findingHasHardIssue(finding);
}

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

function fieldMw(row: SnapshotLike, field: string): number | null {
  return asFiniteNumber((row as Record<string, unknown>)[field]);
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

/**
 * Embedded MW on the snapshot. Prefer explicit embedded columns; otherwise
 * treat `gen_solar_mw` as the embedded-inclusive solar series — on every
 * falsely flagged sunny row the gen−ITSDO gap was 8.9–12.2 GW of solar.
 */
export function snapshotEmbeddedMw(row: SnapshotLike): number {
  const explicitWind = fieldMw(row, "embedded_wind_mw") ?? fieldMw(row, "gen_embedded_wind_mw");
  const explicitSolar = fieldMw(row, "embedded_solar_mw") ?? fieldMw(row, "gen_embedded_solar_mw");
  if (explicitWind != null || explicitSolar != null) {
    return Math.max(0, explicitWind ?? 0) + Math.max(0, explicitSolar ?? 0);
  }
  return Math.max(0, asFiniteNumber(row.gen_solar_mw) ?? 0);
}

/** Headline demand: ITSDO + embedded. Same basis as the dashboard. */
export function snapshotHeadlineDemandMw(row: SnapshotLike): number | null {
  const itsdo = asFiniteNumber(row.demand_mw);
  if (itsdo == null) {
    return null;
  }
  return itsdo + snapshotEmbeddedMw(row);
}

/** Transmission-connected generation: total minus the embedded series. */
export function snapshotTransmissionGenerationMw(row: SnapshotLike): number | null {
  const generation = snapshotDomesticGenerationMw(row);
  if (generation == null) {
    return null;
  }
  return generation - snapshotEmbeddedMw(row);
}

export function snapshotBalanceLimitMultiplier(row: SnapshotLike): number {
  const importsPct = asFiniteNumber(row.gen_imports_pct);
  const exportHeadroom =
    importsPct == null || importsPct < LOW_IMPORT_SHARE_PCT ? SNAPSHOT_EXPORT_HEADROOM : 0;
  return 1 + SNAPSHOT_BALANCE_TOLERANCE + exportHeadroom;
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
  const headlineDemand = snapshotHeadlineDemandMw(row);
  const multiplier = snapshotBalanceLimitMultiplier(row);
  if (
    headlineDemand != null &&
    headlineDemand > 0 &&
    generation != null &&
    generation > headlineDemand * multiplier
  ) {
    issues.push({
      code: "balance",
      field: "generation_mw",
      value: generation,
      limit: headlineDemand * multiplier,
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
  const headlineDemand = snapshotHeadlineDemandMw(row);
  return {
    timestamp: typeof row.timestamp === "string" ? integrityTimestampKey(row.timestamp) : "",
    demandMw,
    generationMw,
    ratio:
      headlineDemand != null && headlineDemand > 0 && generationMw != null
        ? generationMw / headlineDemand
        : null,
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
  return snapshotIntegrityIssues(row, rejectedGenTimes).some(
    (issue) => issueSeverity(issue.code) === "hard"
  );
}

export function snapshotRowHasIntegrityIssues(
  row: SnapshotLike,
  rejectedGenTimes?: Set<string>
): boolean {
  return snapshotIntegrityIssues(row, rejectedGenTimes).length > 0;
}

export function snapshotRowSoftIntegrityIssues(
  row: SnapshotLike,
  rejectedGenTimes?: Set<string>
): SnapshotIntegrityIssue[] {
  return snapshotIntegrityIssues(row, rejectedGenTimes).filter(
    (issue) => issueSeverity(issue.code) === "soft"
  );
}

export function partitionRepairedSnapshotRows(
  rows: SnapshotLike[],
  rejectedGenTimes?: Set<string>
): { repaired: SnapshotLike[]; stillFailing: SnapshotLike[] } {
  const repaired: SnapshotLike[] = [];
  const stillFailing: SnapshotLike[] = [];
  for (const row of rows) {
    if (snapshotRowHasIntegrityIssues(row, rejectedGenTimes)) {
      stillFailing.push(row);
    } else {
      repaired.push(row);
    }
  }
  return { repaired, stillFailing };
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

export function hardIntegrityFindings(report: SnapshotIntegrityReport): SnapshotIntegrityFinding[] {
  return report.failing.filter(findingHasHardIssue);
}

export function softIntegrityFindings(report: SnapshotIntegrityReport): SnapshotIntegrityFinding[] {
  return report.failing.filter(findingHasOnlySoftIssues);
}

export function logSoftIntegrityFindings(report: SnapshotIntegrityReport, label: string): void {
  const soft = softIntegrityFindings(report);
  if (soft.length === 0) {
    return;
  }
  console.warn(`[${label}] keeping ${soft.length} half-hours that failed only the soft balance check`, {
    timestamps: soft.map((finding) => finding.timestamp),
    ratios: soft.map((finding) => finding.ratio),
  });
}

export function integritySourceStatus(report: SnapshotIntegrityReport): {
  source: string;
  ok: boolean;
  rows: number;
  error?: string;
} {
  const hard = hardIntegrityFindings(report);
  if (hard.length === 0) {
    return { source: "snapshot_integrity", ok: true, rows: report.checkedTimestamps.length };
  }
  return {
    source: "snapshot_integrity",
    ok: false,
    rows: hard.length,
    error: `${hard.length} half-hours failed fuel maxima, bounds, or duplicate-publish checks`,
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

export type SnapshotIntegrityLoad =
  | { status: "ok"; value: StoredSnapshotIntegrity | null }
  | { status: "error" };

export async function loadSnapshotIntegrity(): Promise<SnapshotIntegrityLoad> {
  const redis = getRedis();
  if (!redis) {
    return { status: "ok", value: null };
  }
  try {
    return {
      status: "ok",
      value: parseStoredIntegrity(
        await redis.get<StoredSnapshotIntegrity | string>(SNAPSHOT_INTEGRITY_REDIS_KEY)
      ),
    };
  } catch {
    return { status: "error" };
  }
}

export async function readSnapshotIntegrity(): Promise<StoredSnapshotIntegrity | null> {
  const loaded = await loadSnapshotIntegrity();
  return loaded.status === "ok" ? loaded.value : null;
}

export async function recordSnapshotIntegrity(report: SnapshotIntegrityReport): Promise<StoredSnapshotIntegrity> {
  const loaded = await loadSnapshotIntegrity();
  const merged = mergeStoredIntegrity(loaded.status === "ok" ? loaded.value : null, report);
  if (loaded.status === "error") {
    return merged;
  }
  const redis = getRedis();
  if (!redis) {
    return merged;
  }
  try {
    await redis.set(SNAPSHOT_INTEGRITY_REDIS_KEY, JSON.stringify(merged));
  } catch {
    return merged;
  }
  return merged;
}

export function shouldRecordSnapshotIntegrity(
  report: SnapshotIntegrityReport,
  writtenRows: SnapshotLike[],
  ingestFailed: boolean
): boolean {
  if (ingestFailed) {
    return false;
  }
  return writtenRows.length > 0 || report.failing.length > 0;
}

export function writtenIntegrityTimestamps(rows: SnapshotLike[]): string[] {
  return [...normalizeTimestampSet(
    rows.flatMap((row) => (typeof row.timestamp === "string" ? [row.timestamp] : []))
  )].sort();
}

/** Persist written timestamps as checked; keep current findings, including soft-kept rows. */
export function integrityReportForWrittenRows(
  report: SnapshotIntegrityReport,
  writtenRows: SnapshotLike[]
): SnapshotIntegrityReport {
  const written = normalizeTimestampSet(writtenIntegrityTimestamps(writtenRows));
  return {
    ...report,
    checkedTimestamps: [...written].sort(),
    failing: report.failing,
  };
}

/** Re-check written rows for hard and soft issues. Still-failing timestamps stay excluded. */
export function integrityReportForRepairedRows(
  writtenRows: SnapshotLike[],
  now = new Date()
): SnapshotIntegrityReport {
  return inspectSnapshotRows(writtenRows, { now });
}

export function missingAffectedTimestamps(
  affected: Iterable<string>,
  writtenRows: SnapshotLike[]
): string[] {
  const remaining = normalizeTimestampSet(affected);
  for (const timestamp of writtenIntegrityTimestamps(writtenRows)) {
    remaining.delete(timestamp);
  }
  return [...remaining].sort();
}

/**
 * One Tinybird SQL statement: inflated energy_snapshots vs half-hourly FUELINST.
 * Do not issue this from cron — scripts only, one request per run.
 */
export function inflatedSnapshotSql(): string {
  const generationExpr = SNAPSHOT_MW_FIELDS.map((field) => `ifNull(${field}, 0)`).join(" + ");
  const embeddedExpr = "greatest(ifNull(gen_solar_mw, 0), 0)";
  const headlineExpr = `demand_mw + ${embeddedExpr}`;
  const multiplierExpr = `1 + ${SNAPSHOT_BALANCE_TOLERANCE} + if(ifNull(gen_imports_pct, 0) < ${LOW_IMPORT_SHARE_PCT}, ${SNAPSHOT_EXPORT_HEADROOM}, 0)`;
  return `
WITH snaps AS (
  SELECT
    timestamp,
    demand_mw,
    carbon_intensity,
    gen_imports_pct,
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
    ${generationExpr} AS generation_mw,
    ${headlineExpr} AS headline_demand_mw
  FROM energy_snapshots FINAL
  WHERE demand_mw > 0
    AND (${generationExpr}) > (${headlineExpr}) * (${multiplierExpr})
),
fuelinst_5min AS (
  SELECT
    toStartOfInterval(timestamp, INTERVAL 30 minute) AS period,
    timestamp,
    sumIf(generation_mw, fuel_type IN ('ccgt', 'ocgt')) AS gas_mw,
    sumIf(generation_mw, fuel_type = 'coal') AS coal_mw,
    sumIf(generation_mw, fuel_type = 'nuclear') AS nuclear_mw,
    sumIf(generation_mw, fuel_type = 'wind') AS wind_mw,
    sumIf(generation_mw, fuel_type = 'solar') AS solar_mw,
    sumIf(generation_mw, fuel_type = 'npshyd') AS hydro_mw,
    sumIf(generation_mw, fuel_type = 'biomass') AS biomass_mw,
    sumIf(generation_mw, fuel_type IN ('other', 'oil')) AS other_mw,
    sumIf(generation_mw, fuel_type = 'ps') AS pumped_mw
  FROM generation_5min FINAL
  WHERE source = 'fuelinst'
    AND toStartOfInterval(timestamp, INTERVAL 30 minute) IN (SELECT timestamp FROM snaps)
  GROUP BY period, timestamp
),
fuelinst AS (
  SELECT
    period,
    avg(gas_mw) AS fuelinst_gas_mw,
    avg(coal_mw) AS fuelinst_coal_mw,
    avg(nuclear_mw) AS fuelinst_nuclear_mw,
    avg(wind_mw) AS fuelinst_wind_mw,
    avg(solar_mw) AS fuelinst_solar_mw,
    avg(hydro_mw) AS fuelinst_hydro_mw,
    avg(biomass_mw) AS fuelinst_biomass_mw,
    avg(other_mw) AS fuelinst_other_mw,
    avg(pumped_mw) AS fuelinst_pumped_mw
  FROM fuelinst_5min
  GROUP BY period
)
SELECT
  s.timestamp,
  s.demand_mw,
  s.generation_mw,
  s.headline_demand_mw,
  s.generation_mw / s.headline_demand_mw AS ratio,
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
  headline_demand_mw?: number;
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
  const headlineDemand = snapshotHeadlineDemandMw(row);
  if (demand == null || demand <= 0 || generation == null || headlineDemand == null || headlineDemand <= 0) {
    return null;
  }
  if (generation <= headlineDemand * snapshotBalanceLimitMultiplier(row)) {
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
    headline_demand_mw: headlineDemand,
    ratio: generation / headlineDemand,
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
