import {
  collectionIfSourcesOk,
  fetchJson,
  sourceStatusesHaveFailure,
  type CollectionResult,
  type SourceStatus,
} from "@/lib/http";
import { externalCacheKey, readThroughCache } from "@/lib/redis-cache";
import { policyForExternalWindow, policyForSettlementPrices } from "@/lib/tinybird-cache";
import { mapElexonFuel, SNAPSHOT_FUELS, SNAPSHOT_MIX_FUELS } from "@/lib/ingest/fuels";
import { buildSnapshotRow, type CarbonPoint } from "@/lib/ingest/snapshots";
import {
  GB_GENERATION_MAX_MW,
  inspectSnapshotRows,
  snapshotRowFailsIntegrity,
  snapshotRowSoftIntegrityIssues,
  type SnapshotIntegrityReport,
} from "@/lib/snapshot-integrity";
import { formatTinybirdDateTime, parseUtcDateTime } from "@/lib/london-time";
import {
  getSettlementPeriod,
  listRecentSettlementPeriods,
  listSettlementPeriods,
  settlementPeriodToUtc,
  type SettlementPeriod,
} from "@/lib/settlement-period";
import type {
  CarbonIntensityResponse,
  ElexonDemand,
  ElexonGeneration,
  ElexonMarketIndex,
  ElexonSystemPrice,
} from "@/lib/types";

type IntensityRow = CarbonIntensityResponse["data"][number];
type MixRow = {
  from: string;
  to: string;
  generationmix: { fuel: string; perc: number }[];
};

function hourKey(value: Date): string {
  return formatTinybirdDateTime(value);
}

function indexByTimestamp<T>(
  rows: T[],
  getTime: (row: T) => string
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(hourKey(parseUtcDateTime(getTime(row))), row);
  }
  return map;
}

function mixByTimestamp(rows: MixRow[]): Map<string, Record<string, number>> {
  const mixByTime = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const mix: Record<string, number> = {};
    for (const item of row.generationmix) {
      mix[item.fuel] = item.perc;
    }
    mixByTime.set(hourKey(parseUtcDateTime(row.from)), mix);
  }
  return mixByTime;
}

export async function fetchCarbonIntensity(
  fromIso: string,
  toIso: string
): Promise<IntensityRow[]> {
  return readThroughCache(
    externalCacheKey("carbon-intensity", [fromIso, toIso]),
    policyForExternalWindow(toIso),
    async () => {
      const json = await fetchJson<CarbonIntensityResponse>(
        `https://api.carbonintensity.org.uk/intensity/${fromIso}/${toIso}`
      );
      return json.data ?? [];
    }
  );
}

export async function fetchCarbonMix(fromIso: string, toIso: string): Promise<MixRow[]> {
  return readThroughCache(
    externalCacheKey("carbon-mix", [fromIso, toIso]),
    policyForExternalWindow(toIso),
    async () => {
      const json = await fetchJson<{ data: MixRow[] }>(
        `https://api.carbonintensity.org.uk/generation/${fromIso}/${toIso}`
      );
      return json.data ?? [];
    }
  );
}

export async function fetchSystemPrices(
  settlementDate: string,
  now: Date = new Date()
): Promise<ElexonSystemPrice[]> {
  return readThroughCache(
    externalCacheKey("elexon-system-prices", [settlementDate]),
    policyForSettlementPrices(settlementDate, now),
    async () => {
      const json = await fetchJson<{ data: ElexonSystemPrice[] }>(
        `https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/${settlementDate}`
      );
      return json.data ?? [];
    }
  );
}

export const MID_DATA_PROVIDER = "APXMIDP";

export async function fetchMarketIndex(fromIso: string, toIso: string): Promise<ElexonMarketIndex[]> {
  return readThroughCache(
    externalCacheKey("elexon-market-index", [fromIso, toIso]),
    policyForExternalWindow(toIso),
    async () => {
      const json = await fetchJson<{ data: ElexonMarketIndex[] }>(
        `https://data.elexon.co.uk/bmrs/api/v1/balancing/pricing/market-index?from=${fromIso}&to=${toIso}&dataProviders=${MID_DATA_PROVIDER}`
      );
      return json.data ?? [];
    }
  );
}

export function midReadingFromRow(
  row: ElexonMarketIndex
): { price: number; volume: number } | null {
  if (row.dataProvider !== MID_DATA_PROVIDER) {
    return null;
  }
  if (row.volume == null || row.volume === 0 || row.price == null || row.price === 0) {
    return null;
  }
  return { price: row.price, volume: row.volume };
}

/** AGPT/ITSDO publish about an hour after the period; revisions arrive later. */
export const ELEXON_PUBLISH_LAG_MS = 6 * 60 * 60 * 1000;

export function elexonPublishWindow(
  from: Date,
  to: Date,
  now?: Date
): { fromIso: string; toIso: string } {
  const lagged = new Date(to.getTime() + ELEXON_PUBLISH_LAG_MS);
  const publishTo = now && lagged.getTime() > now.getTime() ? now : lagged;
  return {
    fromIso: from.toISOString(),
    toIso: publishTo.toISOString(),
  };
}

/**
 * Settlement-date rewrite / backfill only. A sparse wide row would replace a
 * complete ReplacingMergeTree value with nulls, so demand, price, carbon,
 * mix, and every gen_*_mw must already be numeric.
 */
export function snapshotRowReadyToIngest(row: Record<string, unknown>): boolean {
  if (
    typeof row.demand_mw !== "number" ||
    typeof row.price_gbp_mwh !== "number" ||
    typeof row.carbon_intensity !== "number"
  ) {
    return false;
  }

  for (const fuel of SNAPSHOT_MIX_FUELS) {
    if (typeof row[`gen_${fuel}_pct`] !== "number") {
      return false;
    }
  }

  for (const fuel of SNAPSHOT_FUELS) {
    if (typeof row[`gen_${fuel}_mw`] !== "number") {
      return false;
    }
  }

  return true;
}

export async function fetchElexonWindow<T>(
  dataset: "ITSDO" | "AGPT",
  fromIso: string,
  toIso: string
): Promise<T[]> {
  return readThroughCache(
    externalCacheKey("elexon-dataset", [dataset, fromIso, toIso]),
    policyForExternalWindow(toIso),
    async () => {
      const json = await fetchJson<{ data: T[] }>(
        `https://data.elexon.co.uk/bmrs/api/v1/datasets/${dataset}?publishDateTimeFrom=${fromIso}&publishDateTimeTo=${toIso}`
      );
      return json.data ?? [];
    }
  );
}

export function carbonPointFromRow(row: IntensityRow | undefined): CarbonPoint | null {
  if (!row) {
    return null;
  }

  return {
    actual: row.intensity.actual,
    forecast: row.intensity.forecast,
    index: row.intensity.index,
  };
}

export { GB_GENERATION_MAX_MW };

/** Drop combined PSR types when Elexon also published the split series. */
const AGGREGATE_PSR_WHEN_SPLITS: Record<string, readonly string[]> = {
  Wind: ["Wind Onshore", "Wind Offshore"],
  Hydro: [
    "Hydro Run-of-river and poundage",
    "Hydro Water Reservoir",
    "Hydro Pumped Storage",
  ],
};

export function generationPeriodKey(row: ElexonGeneration): string {
  return row.startTime
    ? hourKey(parseUtcDateTime(row.startTime))
    : hourKey(settlementPeriodToUtc(row.settlementDate, row.settlementPeriod));
}

export function latestPublishTimeWins<T extends { publishTime?: string }>(
  current: T | undefined,
  next: T
): boolean {
  if (!current) {
    return true;
  }
  return (next.publishTime ?? "") > (current.publishTime ?? "");
}

export function generationMwWithinPlausibleMaxima(fuels: Record<string, number>): boolean {
  for (const [fuel, mw] of Object.entries(fuels)) {
    const maxMw = GB_GENERATION_MAX_MW[fuel];
    if (maxMw != null && mw > maxMw) {
      return false;
    }
  }
  return true;
}

export function splitsCoverAggregate(
  aggregateQuantity: number,
  splitQuantities: number[],
  expectedSplitCount: number
): boolean {
  if (splitQuantities.length === 0) {
    return false;
  }
  if (expectedSplitCount > 0 && splitQuantities.length >= expectedSplitCount) {
    return true;
  }
  return splitQuantities.reduce((sum, quantity) => sum + quantity, 0) >= aggregateQuantity;
}

export function dropAggregatePsrDuplicates(
  latestByPeriodAndPsr: Map<string, ElexonGeneration>
): Map<string, ElexonGeneration> {
  const rowsByPeriod = new Map<string, Array<{ key: string; row: ElexonGeneration }>>();
  for (const [key, row] of latestByPeriodAndPsr) {
    const timestamp = generationPeriodKey(row);
    const list = rowsByPeriod.get(timestamp) ?? [];
    list.push({ key, row });
    rowsByPeriod.set(timestamp, list);
  }

  const dropKeys = new Set<string>();
  for (const entries of rowsByPeriod.values()) {
    for (const { key, row } of entries) {
      const splits = AGGREGATE_PSR_WHEN_SPLITS[row.psrType];
      if (!splits) {
        continue;
      }
      const splitEntries = entries.filter((entry) => splits.includes(entry.row.psrType));
      if (
        splitsCoverAggregate(
          row.quantity,
          splitEntries.map((entry) => entry.row.quantity),
          splits.length
        )
      ) {
        dropKeys.add(key);
        continue;
      }
      if (splitEntries.length === 0) {
        continue;
      }
      const aggregateFuel = mapElexonFuel(row.psrType);
      for (const split of splitEntries) {
        if (mapElexonFuel(split.row.psrType) === aggregateFuel) {
          dropKeys.add(split.key);
        }
      }
    }
  }

  const kept = new Map<string, ElexonGeneration>();
  for (const [key, row] of latestByPeriodAndPsr) {
    if (!dropKeys.has(key)) {
      kept.set(key, row);
    }
  }
  return kept;
}

export function groupGenerationMwByPeriod(rows: ElexonGeneration[]): {
  byTime: Map<string, Record<string, number>>;
  rejectedTimes: Set<string>;
} {
  const latestByPeriodAndPsr = new Map<string, ElexonGeneration>();

  for (const row of rows) {
    const timestamp = generationPeriodKey(row);
    const key = `${timestamp}\0${row.psrType}`;
    const existing = latestByPeriodAndPsr.get(key);
    if (latestPublishTimeWins(existing, row)) {
      latestByPeriodAndPsr.set(key, row);
    }
  }

  const byTime = new Map<string, Record<string, number>>();
  for (const row of dropAggregatePsrDuplicates(latestByPeriodAndPsr).values()) {
    const timestamp = generationPeriodKey(row);
    const current = byTime.get(timestamp) ?? {};
    const fuel = mapElexonFuel(row.psrType);
    current[fuel] = (current[fuel] ?? 0) + row.quantity;
    byTime.set(timestamp, current);
  }

  const rejectedTimes = new Set<string>();
  for (const [timestamp, fuels] of byTime) {
    if (!generationMwWithinPlausibleMaxima(fuels)) {
      byTime.delete(timestamp);
      rejectedTimes.add(timestamp);
    }
  }

  return { byTime, rejectedTimes };
}

export function generationMwByPeriod(
  rows: ElexonGeneration[]
): Map<string, Record<string, number>> {
  return groupGenerationMwByPeriod(rows).byTime;
}

export function demandByPeriod(rows: ElexonDemand[]): Map<string, number> {
  const latestByTime = new Map<string, ElexonDemand>();
  for (const row of rows) {
    const timestamp = row.startTime
      ? hourKey(parseUtcDateTime(row.startTime))
      : hourKey(settlementPeriodToUtc(row.settlementDate, row.settlementPeriod));
    const existing = latestByTime.get(timestamp);
    if (latestPublishTimeWins(existing, row)) {
      latestByTime.set(timestamp, row);
    }
  }

  const byTime = new Map<string, number>();
  for (const [timestamp, row] of latestByTime) {
    byTime.set(timestamp, row.demand);
  }
  return byTime;
}

export function priceByPeriod(rows: ElexonSystemPrice[]): Map<string, number> {
  const byTime = new Map<string, number>();
  for (const row of rows) {
    const timestamp = row.startTime
      ? hourKey(parseUtcDateTime(row.startTime))
      : hourKey(settlementPeriodToUtc(row.settlementDate, row.settlementPeriod));
    byTime.set(timestamp, row.systemBuyPrice);
  }
  return byTime;
}

export function midByPeriod(rows: ElexonMarketIndex[]): {
  priceByTime: Map<string, number>;
  volumeByTime: Map<string, number>;
} {
  const priceByTime = new Map<string, number>();
  const volumeByTime = new Map<string, number>();
  for (const row of rows) {
    const reading = midReadingFromRow(row);
    if (!reading) {
      continue;
    }
    const timestamp = row.startTime
      ? hourKey(parseUtcDateTime(row.startTime))
      : hourKey(settlementPeriodToUtc(row.settlementDate, row.settlementPeriod));
    priceByTime.set(timestamp, reading.price);
    volumeByTime.set(timestamp, reading.volume);
  }
  return { priceByTime, volumeByTime };
}

function snapshotRowForPeriod(
  period: SettlementPeriod,
  sources: {
    intensityByTime: Map<string, IntensityRow>;
    mixByTime: Map<string, Record<string, number>>;
    priceByTime: Map<string, number>;
    midPriceByTime: Map<string, number>;
    midVolumeByTime: Map<string, number>;
    demandByTime: Map<string, number>;
    genMwByTime: Map<string, Record<string, number>>;
  }
): Record<string, unknown> {
  const key = hourKey(period.startUtc);
  return buildSnapshotRow({
    timestamp: period.startUtc,
    carbon: carbonPointFromRow(sources.intensityByTime.get(key)),
    mix: sources.mixByTime.get(key) ?? null,
    demandMw: sources.demandByTime.get(key) ?? null,
    priceGbpMwh: sources.priceByTime.get(key) ?? null,
    priceMidGbpMwh: sources.midPriceByTime.get(key) ?? null,
    midVolumeMwh: sources.midVolumeByTime.get(key) ?? null,
    genMw: sources.genMwByTime.get(key) ?? null,
  });
}

export function inspectSnapshotsForPeriods(
  periods: SettlementPeriod[],
  sources: {
    intensityByTime: Map<string, IntensityRow>;
    mixByTime: Map<string, Record<string, number>>;
    priceByTime: Map<string, number>;
    midPriceByTime: Map<string, number>;
    midVolumeByTime: Map<string, number>;
    demandByTime: Map<string, number>;
    genMwByTime: Map<string, Record<string, number>>;
    rejectedGenTimes?: Set<string>;
  },
  options?: { settlementDate?: string; now?: Date }
): SnapshotIntegrityReport {
  return inspectSnapshotRows(
    periods.map((period) => snapshotRowForPeriod(period, sources)),
    {
      settlementDate: options?.settlementDate,
      now: options?.now,
      rejectedGenTimes: sources.rejectedGenTimes,
    }
  );
}

export function buildSnapshotRowsForPeriods(
  periods: SettlementPeriod[],
  sources: {
    intensityByTime: Map<string, IntensityRow>;
    mixByTime: Map<string, Record<string, number>>;
    priceByTime: Map<string, number>;
    midPriceByTime: Map<string, number>;
    midVolumeByTime: Map<string, number>;
    demandByTime: Map<string, number>;
    genMwByTime: Map<string, Record<string, number>>;
    rejectedGenTimes?: Set<string>;
  }
): Record<string, unknown>[] {
  return periods.flatMap((period) => {
    const key = hourKey(period.startUtc);
    if (sources.rejectedGenTimes?.has(key)) {
      return [];
    }
    const row = snapshotRowForPeriod(period, sources);
    if (snapshotRowFailsIntegrity(row, sources.rejectedGenTimes)) {
      return [];
    }
    const soft = snapshotRowSoftIntegrityIssues(row, sources.rejectedGenTimes);
    if (soft.length > 0) {
      console.warn("[snapshots] keeping half-hour that failed only the soft balance check", {
        timestamp: row.timestamp,
        issues: soft,
      });
    }
    return [row];
  });
}

export type SettledFetch<T> = { source: string; value?: T; error?: string };

async function settleFetch<T>(source: string, work: () => Promise<T>): Promise<SettledFetch<T>> {
  try {
    return { source, value: await work() };
  } catch (error) {
    return {
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function statusFromFetch<T>(
  result: SettledFetch<T>,
  count: (value: T) => number
): SourceStatus {
  if (result.error || result.value === undefined) {
    return { source: result.source, ok: false, error: result.error ?? "source failed" };
  }
  return { source: result.source, ok: true, rows: count(result.value) };
}

function requireFetchedRows(status: SourceStatus): SourceStatus {
  if (!status.ok || (status.rows ?? 0) > 0) {
    return status;
  }
  return {
    source: status.source,
    ok: false,
    rows: 0,
    error: `${status.source} returned no rows`,
  };
}

function snapshotMapsFromFetches(parts: {
  intensity: IntensityRow[];
  mix: MixRow[];
  prices: ElexonSystemPrice[];
  marketIndex: ElexonMarketIndex[];
  demand: ElexonDemand[];
  generation: ElexonGeneration[];
}): {
  intensityByTime: Map<string, IntensityRow>;
  mixByTime: Map<string, Record<string, number>>;
  priceByTime: Map<string, number>;
  midPriceByTime: Map<string, number>;
  midVolumeByTime: Map<string, number>;
  demandByTime: Map<string, number>;
  genMwByTime: Map<string, Record<string, number>>;
  rejectedGenTimes: Set<string>;
} {
  const generation = groupGenerationMwByPeriod(parts.generation);
  const mid = midByPeriod(parts.marketIndex);
  return {
    intensityByTime: indexByTimestamp(parts.intensity, (row) => row.from),
    mixByTime: mixByTimestamp(parts.mix),
    priceByTime: priceByPeriod(parts.prices),
    midPriceByTime: mid.priceByTime,
    midVolumeByTime: mid.volumeByTime,
    demandByTime: demandByPeriod(parts.demand),
    genMwByTime: generation.byTime,
    rejectedGenTimes: generation.rejectedTimes,
  };
}

export function snapshotCollectionFromSources(
  periods: SettlementPeriod[],
  sources: {
    intensityByTime: Map<string, IntensityRow>;
    mixByTime: Map<string, Record<string, number>>;
    priceByTime: Map<string, number>;
    midPriceByTime?: Map<string, number>;
    midVolumeByTime?: Map<string, number>;
    demandByTime: Map<string, number>;
    genMwByTime: Map<string, Record<string, number>>;
    rejectedGenTimes?: Set<string>;
  },
  statuses: SourceStatus[],
  options?: { settlementDate?: string; now?: Date }
): CollectionResult {
  const normalized = {
    ...sources,
    midPriceByTime: sources.midPriceByTime ?? new Map(),
    midVolumeByTime: sources.midVolumeByTime ?? new Map(),
  };
  const integrity = inspectSnapshotsForPeriods(periods, normalized, options);
  return {
    ...collectionIfSourcesOk(buildSnapshotRowsForPeriods(periods, normalized), statuses),
    integrity,
  };
}

export type SnapshotHttpWindow = {
  priceDates: string[];
  carbonFrom: string;
  carbonTo: string;
  publishFrom: string;
  publishTo: string;
};

export type CarbonSnapshotParts = {
  intensity: SettledFetch<IntensityRow[]>;
  mix: SettledFetch<MixRow[]>;
};

export type ElexonSnapshotParts = {
  prices: SettledFetch<ElexonSystemPrice[]>;
  marketIndex: SettledFetch<ElexonMarketIndex[]>;
  demand: SettledFetch<ElexonDemand[]>;
  generation: SettledFetch<ElexonGeneration[]>;
};

const RECENT_SNAPSHOT_LOOKBACK_MS = 2.5 * 60 * 60 * 1000;

export function recentSnapshotWindow(now: Date): {
  periods: SettlementPeriod[];
  http: SnapshotHttpWindow;
} | null {
  const periods = listRecentSettlementPeriods(now, RECENT_SNAPSHOT_LOOKBACK_MS);
  if (periods.length === 0) {
    return null;
  }
  return { periods, http: snapshotHttpWindow(periods, now) };
}

export function snapshotHttpWindow(periods: SettlementPeriod[], now?: Date): SnapshotHttpWindow {
  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;
  const publish = elexonPublishWindow(from, to, now);
  return {
    priceDates: [...new Set(periods.map((period) => period.settlementDate))],
    carbonFrom: from.toISOString().replace(".000", ""),
    carbonTo: to.toISOString().replace(".000", ""),
    publishFrom: publish.fromIso,
    publishTo: publish.toIso,
  };
}

export async function fetchCarbonSnapshotParts(
  window: SnapshotHttpWindow
): Promise<CarbonSnapshotParts> {
  const [intensity, mix] = await Promise.all([
    settleFetch("carbon_intensity", () => fetchCarbonIntensity(window.carbonFrom, window.carbonTo)),
    settleFetch("carbon_mix", () => fetchCarbonMix(window.carbonFrom, window.carbonTo)),
  ]);
  return { intensity, mix };
}

export async function fetchElexonSnapshotParts(
  window: SnapshotHttpWindow,
  now?: Date
): Promise<ElexonSnapshotParts> {
  const [prices, marketIndex, demand, generation] = await Promise.all([
    settleFetch("prices", async () => {
      const sets = await Promise.all(window.priceDates.map((date) => fetchSystemPrices(date, now)));
      return sets.flat();
    }),
    settleFetch("market_index", () => fetchMarketIndex(window.carbonFrom, window.carbonTo)),
    settleFetch("demand", () =>
      fetchElexonWindow<ElexonDemand>("ITSDO", window.publishFrom, window.publishTo)
    ),
    settleFetch("generation_mw", () =>
      fetchElexonWindow<ElexonGeneration>("AGPT", window.publishFrom, window.publishTo)
    ),
  ]);
  return { prices, marketIndex, demand, generation };
}

export function assembleSnapshotParts(
  periods: SettlementPeriod[],
  carbon: CarbonSnapshotParts,
  elexon: ElexonSnapshotParts,
  options?: { settlementDate?: string; now?: Date }
): CollectionResult {
  const statuses = [
    statusFromFetch(carbon.intensity, (rows) => rows.length),
    statusFromFetch(carbon.mix, (rows) => rows.length),
    statusFromFetch(elexon.prices, (rows) => rows.length),
    requireFetchedRows(statusFromFetch(elexon.marketIndex, (rows) => rows.length)),
    statusFromFetch(elexon.demand, (rows) => rows.length),
    statusFromFetch(elexon.generation, (rows) => rows.length),
  ];

  return snapshotCollectionFromSources(
    periods,
    snapshotMapsFromFetches({
      intensity: carbon.intensity.value ?? [],
      mix: carbon.mix.value ?? [],
      prices: elexon.prices.value ?? [],
      marketIndex: elexon.marketIndex.value ?? [],
      demand: elexon.demand.value ?? [],
      generation: elexon.generation.value ?? [],
    }),
    statuses,
    options
  );
}

async function collectSnapshotsForPeriods(
  periods: SettlementPeriod[],
  priceDates: string[],
  now?: Date,
  settlementDate?: string
): Promise<CollectionResult> {
  const http = snapshotHttpWindow(periods, now);
  http.priceDates = priceDates;
  const [carbon, elexon] = await Promise.all([
    fetchCarbonSnapshotParts(http),
    fetchElexonSnapshotParts(http, now),
  ]);
  return assembleSnapshotParts(periods, carbon, elexon, { now, settlementDate });
}

export async function collectRecentSnapshots(now: Date): Promise<CollectionResult> {
  const periods = listRecentSettlementPeriods(now, 2.5 * 60 * 60 * 1000);
  if (periods.length === 0) {
    return { rows: [], sources: [] };
  }

  const dates = [...new Set(periods.map((period) => period.settlementDate))];

  return collectSnapshotsForPeriods(periods, dates, now);
}

export function withSettlementDateCoverage(
  result: CollectionResult,
  expectedPeriods: number
): CollectionResult {
  if (sourceStatusesHaveFailure(result.sources)) {
    return result;
  }

  const rows = result.rows.filter(snapshotRowReadyToIngest);
  if (rows.length >= expectedPeriods) {
    return { ...result, rows };
  }

  return {
    ...result,
    rows,
    sources: [
      ...result.sources,
      {
        source: "snapshot_coverage",
        ok: false,
        rows: rows.length,
        error: `incomplete settlement-date coverage: ${rows.length} of ${expectedPeriods} periods ready`,
      },
    ],
  };
}

export async function collectSnapshotsForSettlementDate(
  settlementDate: string,
  now?: Date
): Promise<CollectionResult> {
  const periods = listSettlementPeriods(settlementDate);
  const result = await collectSnapshotsForPeriods(periods, [settlementDate], now, settlementDate);
  return withSettlementDateCoverage(result, periods.length);
}

export function currentHalfHourTimestamp(now: Date): string {
  return hourKey(getSettlementPeriod(now).startUtc);
}
