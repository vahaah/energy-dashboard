import {
  collectionIfSourcesOk,
  fetchJson,
  type CollectionResult,
  type SourceStatus,
} from "@/lib/http";
import { mapElexonFuel } from "@/lib/ingest/fuels";
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
  const json = await fetchJson<CarbonIntensityResponse>(
    `https://api.carbonintensity.org.uk/intensity/${fromIso}/${toIso}`
  );
  return json.data ?? [];
}

export async function fetchCarbonMix(fromIso: string, toIso: string): Promise<MixRow[]> {
  const json = await fetchJson<{ data: MixRow[] }>(
    `https://api.carbonintensity.org.uk/generation/${fromIso}/${toIso}`
  );
  return json.data ?? [];
}

export async function fetchSystemPrices(settlementDate: string): Promise<ElexonSystemPrice[]> {
  const json = await fetchJson<{ data: ElexonSystemPrice[] }>(
    `https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices/${settlementDate}`
  );
  return json.data ?? [];
}

export async function fetchElexonWindow<T>(
  dataset: "ITSDO" | "AGPT",
  fromIso: string,
  toIso: string
): Promise<T[]> {
  const json = await fetchJson<{ data: T[] }>(
    `https://data.elexon.co.uk/bmrs/api/v1/datasets/${dataset}?publishDateTimeFrom=${fromIso}&publishDateTimeTo=${toIso}`
  );
  return json.data ?? [];
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

export function generationMwByPeriod(
  rows: ElexonGeneration[]
): Map<string, Record<string, number>> {
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

  for (const [timestamp, fuels] of byTime) {
    if (!generationMwWithinPlausibleMaxima(fuels)) {
      byTime.delete(timestamp);
    }
  }

  return byTime;
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

export function buildSnapshotRowsForPeriods(
  periods: SettlementPeriod[],
  sources: {
    intensityByTime: Map<string, IntensityRow>;
    mixByTime: Map<string, Record<string, number>>;
    priceByTime: Map<string, number>;
    demandByTime: Map<string, number>;
    genMwByTime: Map<string, Record<string, number>>;
  }
): Record<string, unknown>[] {
  return periods.map((period) => {
    const key = hourKey(period.startUtc);
    return buildSnapshotRow({
      timestamp: period.startUtc,
      carbon: carbonPointFromRow(sources.intensityByTime.get(key)),
      mix: sources.mixByTime.get(key) ?? null,
      demandMw: sources.demandByTime.get(key) ?? null,
      priceGbpMwh: sources.priceByTime.get(key) ?? null,
      genMw: sources.genMwByTime.get(key) ?? null,
    });
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

function snapshotMapsFromFetches(parts: {
  intensity: IntensityRow[];
  mix: MixRow[];
  prices: ElexonSystemPrice[];
  demand: ElexonDemand[];
  generation: ElexonGeneration[];
}): {
  intensityByTime: Map<string, IntensityRow>;
  mixByTime: Map<string, Record<string, number>>;
  priceByTime: Map<string, number>;
  demandByTime: Map<string, number>;
  genMwByTime: Map<string, Record<string, number>>;
} {
  return {
    intensityByTime: indexByTimestamp(parts.intensity, (row) => row.from),
    mixByTime: mixByTimestamp(parts.mix),
    priceByTime: priceByPeriod(parts.prices),
    demandByTime: demandByPeriod(parts.demand),
    genMwByTime: generationMwByPeriod(parts.generation),
  };
}

export function snapshotCollectionFromSources(
  periods: SettlementPeriod[],
  sources: {
    intensityByTime: Map<string, IntensityRow>;
    mixByTime: Map<string, Record<string, number>>;
    priceByTime: Map<string, number>;
    demandByTime: Map<string, number>;
    genMwByTime: Map<string, Record<string, number>>;
  },
  statuses: SourceStatus[]
): CollectionResult {
  return collectionIfSourcesOk(buildSnapshotRowsForPeriods(periods, sources), statuses);
}

async function collectSnapshotsForPeriods(
  periods: SettlementPeriod[],
  fromIso: string,
  toIso: string,
  priceDates: string[]
): Promise<CollectionResult> {
  const carbonFrom = fromIso.replace(".000", "");
  const carbonTo = toIso.replace(".000", "");

  const [intensity, mix, prices, demand, generation] = await Promise.all([
    settleFetch("carbon_intensity", () => fetchCarbonIntensity(carbonFrom, carbonTo)),
    settleFetch("carbon_mix", () => fetchCarbonMix(carbonFrom, carbonTo)),
    settleFetch("prices", async () => {
      const sets = await Promise.all(priceDates.map((date) => fetchSystemPrices(date)));
      return sets.flat();
    }),
    settleFetch("demand", () => fetchElexonWindow<ElexonDemand>("ITSDO", fromIso, toIso)),
    settleFetch("generation_mw", () => fetchElexonWindow<ElexonGeneration>("AGPT", fromIso, toIso)),
  ]);

  const statuses = [
    statusFromFetch(intensity, (rows) => rows.length),
    statusFromFetch(mix, (rows) => rows.length),
    statusFromFetch(prices, (rows) => rows.length),
    statusFromFetch(demand, (rows) => rows.length),
    statusFromFetch(generation, (rows) => rows.length),
  ];

  return snapshotCollectionFromSources(
    periods,
    snapshotMapsFromFetches({
      intensity: intensity.value ?? [],
      mix: mix.value ?? [],
      prices: prices.value ?? [],
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

  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;
  const dates = [...new Set(periods.map((period) => period.settlementDate))];

  return collectSnapshotsForPeriods(periods, from.toISOString(), to.toISOString(), dates);
}

export async function collectSnapshotsForSettlementDate(
  settlementDate: string
): Promise<CollectionResult> {
  const periods = listSettlementPeriods(settlementDate);
  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;

  return collectSnapshotsForPeriods(
    periods,
    from.toISOString(),
    to.toISOString(),
    [settlementDate]
  );
}

export function currentHalfHourTimestamp(now: Date): string {
  return hourKey(getSettlementPeriod(now).startUtc);
}
