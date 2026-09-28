import {
  formatLondonDateLabel,
  formatTinybirdDateTime,
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

export function isEmbeddedFuel(fuelType: string): boolean {
  const fuel = normalizeFuelType(fuelType);
  return fuel === "embedded_wind" || fuel === "embedded_solar";
}

export function isPumpedStorageFuel(fuelType: string): boolean {
  return normalizeFuelType(fuelType) === "ps";
}

/** NESO / PV Live half-hours can lead the latest FUELINST frame by up to one SP. */
export const EMBEDDED_ALIGN_WINDOW_MS = 30 * 60 * 1000;

export type GenerationShare = {
  fuel: string;
  mw: number;
  sharePct: number;
};

export type DemandPoint = {
  time: string;
  demand: number | null;
};

export type DemandBalancePoint = {
  time: string;
  demandMw: number | null;
  domesticGenerationMw: number | null;
};

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
  const fuelinstTimestamp = latestFuelinstTimestamp(rows);
  if (!fuelinstTimestamp) {
    return {
      latestTimestamp: "",
      sources: [],
      interconnectors: [],
      totalGenerationMw: 0,
      netTransfersMw: 0,
    };
  }

  const fuelinstMs = parseUtcDateTime(fuelinstTimestamp).getTime();
  const embeddedCutoffMs = fuelinstMs + EMBEDDED_ALIGN_WINDOW_MS;
  const latestByFuel = new Map<string, Generation5min>();

  for (const row of rows) {
    const rowMs = parseUtcDateTime(row.timestamp).getTime();
    const cutoff = isEmbeddedFuel(row.fuel_type) ? embeddedCutoffMs : fuelinstMs;
    if (rowMs > cutoff) {
      continue;
    }

    const key = normalizeFuelType(row.fuel_type);
    const existing = latestByFuel.get(key);
    if (!existing || row.timestamp > existing.timestamp) {
      latestByFuel.set(key, row);
    }
  }

  const sources: Generation5min[] = [];
  const interconnectors: Generation5min[] = [];
  let netTransfersMw = 0;

  for (const row of latestByFuel.values()) {
    if (isInterconnectorFuel(row.fuel_type)) {
      interconnectors.push(row);
      netTransfersMw += row.generation_mw;
      continue;
    }

    sources.push(row);
  }

  return {
    latestTimestamp: fuelinstTimestamp,
    sources,
    interconnectors,
    totalGenerationMw: domesticGenerationMw(sources),
    netTransfersMw,
  };
}

export function latestFuelinstTimestamp(rows: Generation5min[]): string | null {
  let latest: string | null = null;

  for (const row of rows) {
    if (isEmbeddedFuel(row.fuel_type)) {
      continue;
    }
    if (!latest || row.timestamp > latest) {
      latest = row.timestamp;
    }
  }

  return latest;
}

export function domesticGenerationMw(rows: Iterable<Generation5min>): number {
  let total = 0;

  for (const row of rows) {
    if (isInterconnectorFuel(row.fuel_type)) {
      continue;
    }
    if (isPumpedStorageFuel(row.fuel_type) && row.generation_mw < 0) {
      continue;
    }
    total += row.generation_mw;
  }

  return total;
}

export function groupGenerationMw(rows: Iterable<Generation5min>): Record<string, number> {
  const grouped: Record<string, number> = {};

  for (const row of rows) {
    if (isInterconnectorFuel(row.fuel_type)) {
      if (row.generation_mw > 0) {
        grouped.imports = (grouped.imports ?? 0) + row.generation_mw;
      }
      continue;
    }

    if (isPumpedStorageFuel(row.fuel_type) && row.generation_mw < 0) {
      continue;
    }

    const fuel = mapGenerationFuelToStackKey(row.fuel_type);
    grouped[fuel] = (grouped[fuel] ?? 0) + row.generation_mw;
  }

  return grouped;
}

export function generationSharesFromRows(rows: Iterable<Generation5min>): GenerationShare[] {
  const grouped = groupGenerationMw(rows);
  const total = Object.values(grouped).reduce((sum, mw) => sum + mw, 0);
  if (total === 0) {
    return [];
  }

  const shares: GenerationShare[] = [];
  for (const [fuel, mw] of Object.entries(grouped)) {
    if (mw === 0) {
      continue;
    }
    shares.push({
      fuel,
      mw,
      sharePct: (mw / total) * 100,
    });
  }

  return shares;
}

export function mixPercentagesFromShares(
  shares: GenerationShare[]
): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const share of shares) {
    mix[share.fuel] = share.sharePct;
  }
  return mix;
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

export function demandPointsFromSnapshots(snapshots: EnergySnapshot[]): DemandPoint[] {
  return snapshots.map((snapshot) => ({
    time: snapshot.timestamp,
    demand: snapshot.demand_mw,
  }));
}

export function buildDemandBalanceSeries(
  snapshots: EnergySnapshot[],
  generation: Generation5min[],
  range: TimeRange
): DemandBalancePoint[] {
  const bucketMs = getDemandBalanceBucketSizeMs(range);
  const generationByBucket = new Map<number, Map<string, { sum: number; count: number }>>();
  const demandByBucket = new Map<number, { sum: number; count: number }>();

  for (const row of generation) {
    const parsed = parseUtcDateTime(row.timestamp).getTime();
    if (Number.isNaN(parsed)) {
      continue;
    }

    const bucket = Math.floor(parsed / bucketMs) * bucketMs;
    const fuels = generationByBucket.get(bucket) ?? new Map();
    const fuel = normalizeFuelType(row.fuel_type);
    const existing = fuels.get(fuel);
    if (existing) {
      existing.sum += row.generation_mw;
      existing.count += 1;
    } else {
      fuels.set(fuel, { sum: row.generation_mw, count: 1 });
    }
    generationByBucket.set(bucket, fuels);
  }

  const snapshotBuckets = new Set<number>();

  for (const snapshot of snapshots) {
    const parsed = parseUtcDateTime(snapshot.timestamp).getTime();
    if (Number.isNaN(parsed)) {
      continue;
    }

    const bucket = Math.floor(parsed / bucketMs) * bucketMs;
    snapshotBuckets.add(bucket);
    if (snapshot.demand_mw == null) {
      continue;
    }

    const existing = demandByBucket.get(bucket);
    if (existing) {
      existing.sum += snapshot.demand_mw;
      existing.count += 1;
    } else {
      demandByBucket.set(bucket, { sum: snapshot.demand_mw, count: 1 });
    }
  }

  const buckets = new Set<number>([
    ...generationByBucket.keys(),
    ...snapshotBuckets,
  ]);
  const times = Array.from(buckets).sort((left, right) => left - right);
  let lastEmbeddedWind: number | null = null;
  let lastEmbeddedSolar: number | null = null;
  const points: DemandBalancePoint[] = [];

  for (const time of times) {
    const averaged = averageFuelsInBucket(generationByBucket.get(time));
    if (averaged.has("embedded_wind")) {
      lastEmbeddedWind = averaged.get("embedded_wind") ?? null;
    } else if (lastEmbeddedWind != null) {
      averaged.set("embedded_wind", lastEmbeddedWind);
    }

    if (averaged.has("embedded_solar")) {
      lastEmbeddedSolar = averaged.get("embedded_solar") ?? null;
    } else if (lastEmbeddedSolar != null) {
      averaged.set("embedded_solar", lastEmbeddedSolar);
    }

    const demand = demandByBucket.get(time);
    points.push({
      time: formatTinybirdDateTime(new Date(time)),
      demandMw: demand ? demand.sum / demand.count : null,
      domesticGenerationMw: domesticGenerationFromFuelMap(averaged),
    });
  }

  return points;
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

function getDemandBalanceBucketSizeMs(range: TimeRange): number {
  switch (range) {
    case "24h":
      return 30 * 60 * 1000;
    case "7d":
      return 60 * 60 * 1000;
    case "30d":
    case "90d":
    case "1y":
      return 24 * 60 * 60 * 1000;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

function averageFuelsInBucket(
  fuels: Map<string, { sum: number; count: number }> | undefined
): Map<string, number> {
  const averaged = new Map<string, number>();
  if (!fuels) {
    return averaged;
  }

  for (const [fuel, { sum, count }] of fuels) {
    averaged.set(fuel, sum / count);
  }

  return averaged;
}

function domesticGenerationFromFuelMap(fuels: Map<string, number>): number | null {
  let hasFuelinstDomestic = false;
  let total = 0;

  for (const [fuel, mw] of fuels) {
    if (isInterconnectorFuel(fuel)) {
      continue;
    }
    if (isPumpedStorageFuel(fuel) && mw < 0) {
      continue;
    }
    if (!isEmbeddedFuel(fuel)) {
      hasFuelinstDomestic = true;
    }
    total += mw;
  }

  return hasFuelinstDomestic ? total : null;
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
