import {
  collectionIfSourcesOk,
  fetchJson,
  sourceStatusesHaveFailure,
  type CollectionResult,
  type SourceStatus,
} from "@/lib/http";
import { externalCacheKey, readThroughCache } from "@/lib/redis-cache";
import { policyForExternalWindow } from "@/lib/tinybird-cache";
import { mapElexonFuel, SNAPSHOT_FUELS, SNAPSHOT_MIX_FUELS } from "@/lib/ingest/fuels";
import { buildSnapshotRow, type CarbonPoint } from "@/lib/ingest/snapshots";
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

export async function fetchSystemPrices(settlementDate: string): Promise<ElexonSystemPrice[]> {
  return readThroughCache(
    externalCacheKey("elexon-system-prices", [settlementDate]),
    policyForExternalWindow(`${settlementDate}T23:59:59.000Z`),
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
  for (const row of latestByPeriodAndPsr.values()) {
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
    return [
      buildSnapshotRow({
        timestamp: period.startUtc,
        carbon: carbonPointFromRow(sources.intensityByTime.get(key)),
        mix: sources.mixByTime.get(key) ?? null,
        demandMw: sources.demandByTime.get(key) ?? null,
        priceGbpMwh: sources.priceByTime.get(key) ?? null,
        priceMidGbpMwh: sources.midPriceByTime.get(key) ?? null,
        midVolumeMwh: sources.midVolumeByTime.get(key) ?? null,
        genMw: sources.genMwByTime.get(key) ?? null,
      }),
    ];
  });
}

type SettledFetch<T> = { source: string; value?: T; error?: string };

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
  statuses: SourceStatus[]
): CollectionResult {
  return collectionIfSourcesOk(
    buildSnapshotRowsForPeriods(periods, {
      ...sources,
      midPriceByTime: sources.midPriceByTime ?? new Map(),
      midVolumeByTime: sources.midVolumeByTime ?? new Map(),
    }),
    statuses
  );
}

async function collectSnapshotsForPeriods(
  periods: SettlementPeriod[],
  priceDates: string[],
  now?: Date
): Promise<CollectionResult> {
  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;
  const carbonFrom = from.toISOString().replace(".000", "");
  const carbonTo = to.toISOString().replace(".000", "");
  const publish = elexonPublishWindow(from, to, now);

  const [intensity, mix, prices, marketIndex, demand, generation] = await Promise.all([
    settleFetch("carbon_intensity", () => fetchCarbonIntensity(carbonFrom, carbonTo)),
    settleFetch("carbon_mix", () => fetchCarbonMix(carbonFrom, carbonTo)),
    settleFetch("prices", async () => {
      const sets = await Promise.all(priceDates.map((date) => fetchSystemPrices(date)));
      return sets.flat();
    }),
    settleFetch("market_index", () => fetchMarketIndex(carbonFrom, carbonTo)),
    settleFetch("demand", () =>
      fetchElexonWindow<ElexonDemand>("ITSDO", publish.fromIso, publish.toIso)
    ),
    settleFetch("generation_mw", () =>
      fetchElexonWindow<ElexonGeneration>("AGPT", publish.fromIso, publish.toIso)
    ),
  ]);

  const statuses = [
    statusFromFetch(intensity, (rows) => rows.length),
    statusFromFetch(mix, (rows) => rows.length),
    statusFromFetch(prices, (rows) => rows.length),
    requireFetchedRows(statusFromFetch(marketIndex, (rows) => rows.length)),
    statusFromFetch(demand, (rows) => rows.length),
    statusFromFetch(generation, (rows) => rows.length),
  ];

  return snapshotCollectionFromSources(
    periods,
    snapshotMapsFromFetches({
      intensity: intensity.value ?? [],
      mix: mix.value ?? [],
      prices: prices.value ?? [],
      marketIndex: marketIndex.value ?? [],
      demand: demand.value ?? [],
      generation: generation.value ?? [],
    }),
    statuses
  );
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
  const result = await collectSnapshotsForPeriods(periods, [settlementDate], now);
  return withSettlementDateCoverage(result, periods.length);
}

export function currentHalfHourTimestamp(now: Date): string {
  return hourKey(getSettlementPeriod(now).startUtc);
}
