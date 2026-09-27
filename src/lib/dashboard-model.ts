import {
  formatLondonDateLabel,
  getLondonDateTimeParts,
  getLondonOffsetLabel,
  parseUtcDateTime,
} from "@/lib/london-time";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { EnergySnapshot, Generation5min, NullableNumber, TimeRange } from "@/lib/types";

export type SnapshotGranularity = "native" | "day" | "week";

export interface MetricSummary {
  latest: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
  deltaFromAverage: number | null;
}

export interface RangeSummary {
  carbon: MetricSummary;
  demand: MetricSummary;
  price: MetricSummary;
}

export interface HeadlineField<T> {
  value: T | null;
  timestamp: string | null;
}

export interface HeadlineMetrics {
  referenceTimestamp: string | null;
  carbon: HeadlineField<number> & { index: string | null };
  demand: HeadlineField<number>;
  price: HeadlineField<number>;
  mixSnapshot: EnergySnapshot | null;
}

const MIX_PCT_FIELDS = [
  "gen_gas_pct",
  "gen_coal_pct",
  "gen_nuclear_pct",
  "gen_wind_pct",
  "gen_solar_pct",
  "gen_hydro_pct",
  "gen_biomass_pct",
  "gen_imports_pct",
  "gen_other_pct",
] as const satisfies readonly (keyof EnergySnapshot)[];

export interface SplitGenerationRows {
  latestTimestamp: string;
  sources: Generation5min[];
  interconnectors: Generation5min[];
  totalGenerationMw: number;
  netTransfersMw: number;
}

export const GENERATION_STACK_FUELS = [
  "embedded_wind",
  "embedded_solar",
  "wind",
  "nuclear",
  "hydro",
  "biomass",
  "gas",
  "coal",
  "imports",
  "other",
] as const;

export type GenerationStackFuel = (typeof GENERATION_STACK_FUELS)[number];

const EMBEDDED_STACK_FUELS: ReadonlySet<GenerationStackFuel> = new Set([
  "embedded_wind",
  "embedded_solar",
]);

export type GenerationStackPoint = {
  time: number;
} & Record<GenerationStackFuel, number>;

export function normalizeFuelType(fuelType: string): string {
  return fuelType.trim().toLowerCase();
}

export function isInterconnectorFuel(fuelType: string): boolean {
  return normalizeFuelType(fuelType).startsWith("int");
}

export function mapGenerationFuelToStackKey(fuelType: string): string {
  const fuel = normalizeFuelType(fuelType);

  switch (fuel) {
    case "ccgt":
    case "ocgt":
      return "gas";
    case "npshyd":
    case "ps":
      return "hydro";
    case "oil":
      return "other";
    default:
      return fuel;
  }
}

export function splitLatestGenerationRows(
  rows: Generation5min[]
): SplitGenerationRows {
  if (rows.length === 0) {
    return {
      latestTimestamp: "",
      sources: [],
      interconnectors: [],
      totalGenerationMw: 0,
      netTransfersMw: 0,
    };
  }

  const latestByFuel = new Map<string, Generation5min>();
  for (const row of rows) {
    const key = normalizeFuelType(row.fuel_type);
    const existing = latestByFuel.get(key);
    if (!existing || row.timestamp > existing.timestamp) {
      latestByFuel.set(key, row);
    }
  }

  const latestRows = Array.from(latestByFuel.values());
  const latestTimestamp = latestRows.reduce(
    (latest, row) => (row.timestamp > latest ? row.timestamp : latest),
    ""
  );
  const sources: Generation5min[] = [];
  const interconnectors: Generation5min[] = [];

  let totalGenerationMw = 0;
  let netTransfersMw = 0;

  for (const row of latestRows) {
    if (isInterconnectorFuel(row.fuel_type)) {
      interconnectors.push(row);
      netTransfersMw += row.generation_mw;
      continue;
    }

    sources.push(row);
    totalGenerationMw += row.generation_mw;
  }

  return {
    latestTimestamp,
    sources,
    interconnectors,
    totalGenerationMw,
    netTransfersMw,
  };
}

export function buildGenerationStackSeries(
  rows: Generation5min[],
  range: TimeRange
): GenerationStackPoint[] {
  const bucketSizeMs = getGenerationBucketSizeMs(range);
  const byBucket = new Map<number, Partial<Record<GenerationStackFuel, number>>>();

  for (const row of rows) {
    const parsed = parseGenerationTimestamp(row.timestamp);
    if (Number.isNaN(parsed)) {
      continue;
    }

    const bucket = Math.floor(parsed / bucketSizeMs) * bucketSizeMs;
    if (!byBucket.has(bucket)) {
      byBucket.set(bucket, {});
    }

    const entry = byBucket.get(bucket);

    if (!entry) {
      continue;
    }

    if (isInterconnectorFuel(row.fuel_type)) {
      if (row.generation_mw > 0) {
        entry.imports = Number(entry.imports ?? 0) + row.generation_mw;
      }
      continue;
    }

    const fuel = mapGenerationFuelToStackKey(row.fuel_type);
    if (!isGenerationStackFuel(fuel)) {
      continue;
    }

    entry[fuel] = Number(entry[fuel] ?? 0) + row.generation_mw;
  }

  return Array.from(byBucket.entries())
    .sort(([left], [right]) => left - right)
    .filter(([, values]) => stackBucketHasTransmissionFuel(values))
    .map(([time, values]) => {
      const total = GENERATION_STACK_FUELS.reduce(
        (sum, fuel) => sum + Number(values[fuel] ?? 0),
        0
      );

      const point = { time } as GenerationStackPoint;

      for (const fuel of GENERATION_STACK_FUELS) {
        point[fuel] =
          total > 0 ? (Number(values[fuel] ?? 0) / total) * 100 : 0;
      }

      return point;
    });
}

export function buildRangeSummary(snapshots: EnergySnapshot[]): RangeSummary {
  return {
    carbon: summarizeMetric(snapshots.map((snapshot) => snapshot.carbon_intensity)),
    demand: summarizeMetric(snapshots.map((snapshot) => snapshot.demand_mw)),
    price: summarizeMetric(snapshots.map((snapshot) => snapshot.price_gbp_mwh)),
  };
}

export function latestSnapshotWithField<K extends keyof EnergySnapshot>(
  snapshots: EnergySnapshot[],
  field: K
): EnergySnapshot | null {
  let latest: EnergySnapshot | null = null;

  for (const snapshot of snapshots) {
    if (snapshot[field] == null) {
      continue;
    }

    if (!latest || snapshot.timestamp > latest.timestamp) {
      latest = snapshot;
    }
  }

  return latest;
}

export function latestSnapshotWithMix(snapshots: EnergySnapshot[]): EnergySnapshot | null {
  let latest: EnergySnapshot | null = null;

  for (const snapshot of snapshots) {
    if (!MIX_PCT_FIELDS.some((field) => snapshot[field] != null)) {
      continue;
    }

    if (!latest || snapshot.timestamp > latest.timestamp) {
      latest = snapshot;
    }
  }

  return latest;
}

export function buildHeadlineMetrics(
  snapshots: EnergySnapshot[],
  granularity: SnapshotGranularity = "native"
): HeadlineMetrics {
  if (isAggregatedGranularity(granularity)) {
    return {
      referenceTimestamp: null,
      carbon: { value: null, timestamp: null, index: null },
      demand: { value: null, timestamp: null },
      price: { value: null, timestamp: null },
      mixSnapshot: null,
    };
  }

  const carbonRow = latestSnapshotWithField(snapshots, "carbon_intensity");
  const demandRow = latestSnapshotWithField(snapshots, "demand_mw");
  const priceRow = latestSnapshotWithField(snapshots, "price_gbp_mwh");

  return {
    referenceTimestamp: latestTimestampAmong([
      carbonRow?.timestamp,
      demandRow?.timestamp,
      priceRow?.timestamp,
    ]),
    carbon: {
      value: carbonRow?.carbon_intensity ?? null,
      timestamp: carbonRow?.timestamp ?? null,
      index: carbonRow?.carbon_index ?? null,
    },
    demand: {
      value: demandRow?.demand_mw ?? null,
      timestamp: demandRow?.timestamp ?? null,
    },
    price: {
      value: priceRow?.price_gbp_mwh ?? null,
      timestamp: priceRow?.timestamp ?? null,
    },
    mixSnapshot: latestSnapshotWithMix(snapshots),
  };
}

export function formatSettlementWindow(timestamp: string): string {
  const period = getSettlementPeriod(parseUtcDateTime(timestamp));
  const start = formatClock(period.startUtc);
  const end = formatClock(period.endUtc);
  const startZone = getLondonOffsetLabel(period.startUtc);
  const endZone = getLondonOffsetLabel(period.endUtc);
  const window =
    startZone === endZone
      ? `${start}–${end} ${startZone}`
      : `${start} ${startZone}–${end} ${endZone}`;

  return `SP ${period.settlementPeriod}, ${window}`;
}

export function formatHeadlinePeriod(
  timestamp: string,
  granularity: SnapshotGranularity = "native"
): string {
  if (isAggregatedGranularity(granularity)) {
    return formatLondonDateLabel(parseUtcDateTime(timestamp));
  }

  return formatSettlementWindow(timestamp);
}

export function headlineAsOf(
  timestamp: string | null,
  referenceTimestamp: string | null,
  granularity: SnapshotGranularity = "native"
): string | null {
  if (timestamp == null || referenceTimestamp == null || sameTimestamp(timestamp, referenceTimestamp)) {
    return null;
  }

  return formatHeadlinePeriod(timestamp, granularity);
}

function isAggregatedGranularity(granularity: SnapshotGranularity): boolean {
  switch (granularity) {
    case "native":
      return false;
    case "day":
    case "week":
      return true;
    default: {
      const exhaustive: never = granularity;
      return exhaustive;
    }
  }
}

function latestTimestampAmong(timestamps: Array<string | null | undefined>): string | null {
  let latest: string | null = null;

  for (const timestamp of timestamps) {
    if (!timestamp) {
      continue;
    }

    if (!latest || timestamp > latest) {
      latest = timestamp;
    }
  }

  return latest;
}

function sameTimestamp(left: string, right: string): boolean {
  return parseUtcDateTime(left).getTime() === parseUtcDateTime(right).getTime();
}

function formatClock(date: Date): string {
  const parts = getLondonDateTimeParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function summarizeMetric(values: NullableNumber[]): MetricSummary {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) {
    return {
      latest: null,
      average: null,
      min: null,
      max: null,
      deltaFromAverage: null,
    };
  }

  const latestPresent = [...values].reverse().find((value): value is number => value != null);
  const latest = roundNumber(latestPresent ?? present[present.length - 1]);
  const average = roundNumber(
    present.reduce((sum, value) => sum + value, 0) / present.length
  );
  const min = roundNumber(Math.min(...present));
  const max = roundNumber(Math.max(...present));

  return {
    latest,
    average,
    min,
    max,
    deltaFromAverage: roundNumber(latest - average),
  };
}

function roundNumber(value: number): number {
  return Math.round(value);
}

function getGenerationBucketSizeMs(range: TimeRange): number {
  switch (range) {
    case "24h":
      return 30 * 60 * 1000;
    case "7d":
    case "30d":
      return 60 * 60 * 1000;
    case "90d":
    case "1y":
      return 24 * 60 * 60 * 1000;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

function parseGenerationTimestamp(value: string): number {
  return new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z").getTime();
}

function isGenerationStackFuel(fuel: string): fuel is GenerationStackFuel {
  for (const stackFuel of GENERATION_STACK_FUELS) {
    if (stackFuel === fuel) {
      return true;
    }
  }
  return false;
}

function stackBucketHasTransmissionFuel(
  values: Partial<Record<GenerationStackFuel, number>>
): boolean {
  for (const fuel of GENERATION_STACK_FUELS) {
    if (EMBEDDED_STACK_FUELS.has(fuel)) {
      continue;
    }
    if (Number(values[fuel] ?? 0) !== 0) {
      return true;
    }
  }
  return false;
}
