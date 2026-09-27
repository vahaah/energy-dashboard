import { fetchJson } from "@/lib/http";
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

export function emptyCarbonWindows(): {
  intensityByTime: Map<string, IntensityRow>;
  mixByTime: Map<string, Record<string, number>>;
} {
  return {
    intensityByTime: new Map(),
    mixByTime: new Map(),
  };
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

export async function fetchCarbonWindows(fromIso: string, toIso: string): Promise<{
  intensityByTime: Map<string, IntensityRow>;
  mixByTime: Map<string, Record<string, number>>;
}> {
  const [intensityResult, generationResult] = await Promise.allSettled([
    fetchJson<CarbonIntensityResponse>(
      `https://api.carbonintensity.org.uk/intensity/${fromIso}/${toIso}`
    ),
    fetchJson<{ data: MixRow[] }>(
      `https://api.carbonintensity.org.uk/generation/${fromIso}/${toIso}`
    ),
  ]);

  return {
    intensityByTime:
      intensityResult.status === "fulfilled"
        ? indexByTimestamp(intensityResult.value.data ?? [], (row) => row.from)
        : new Map(),
    mixByTime:
      generationResult.status === "fulfilled"
        ? mixByTimestamp(generationResult.value.data ?? [])
        : new Map(),
  };
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

export function generationMwByPeriod(
  rows: ElexonGeneration[]
): Map<string, Record<string, number>> {
  const byTime = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const timestamp = row.startTime
      ? hourKey(parseUtcDateTime(row.startTime))
      : hourKey(settlementPeriodToUtc(row.settlementDate, row.settlementPeriod));
    const current = byTime.get(timestamp) ?? {};
    const fuel = mapElexonFuel(row.psrType);
    current[fuel] = (current[fuel] ?? 0) + row.quantity;
    byTime.set(timestamp, current);
  }

  return byTime;
}

export function demandByPeriod(rows: ElexonDemand[]): Map<string, number> {
  const byTime = new Map<string, number>();
  for (const row of rows) {
    const timestamp = row.startTime
      ? hourKey(parseUtcDateTime(row.startTime))
      : hourKey(settlementPeriodToUtc(row.settlementDate, row.settlementPeriod));
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

async function settledValue<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

export async function collectRecentSnapshots(now: Date): Promise<Record<string, unknown>[]> {
  const periods = listRecentSettlementPeriods(now, 2.5 * 60 * 60 * 1000);
  if (periods.length === 0) {
    return [];
  }

  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const dates = [...new Set(periods.map((period) => period.settlementDate))];

  const [carbon, priceSets, demandRows, genRows] = await Promise.all([
    settledValue(
      () =>
        fetchCarbonWindows(
          from.toISOString().replace(".000", ""),
          to.toISOString().replace(".000", "")
        ),
      emptyCarbonWindows()
    ),
    Promise.all(
      dates.map((date) => settledValue(() => fetchSystemPrices(date), [] as ElexonSystemPrice[]))
    ),
    settledValue(() => fetchElexonWindow<ElexonDemand>("ITSDO", fromIso, toIso), []),
    settledValue(() => fetchElexonWindow<ElexonGeneration>("AGPT", fromIso, toIso), []),
  ]);

  return buildSnapshotRowsForPeriods(periods, {
    intensityByTime: carbon.intensityByTime,
    mixByTime: carbon.mixByTime,
    priceByTime: priceByPeriod(priceSets.flat()),
    demandByTime: demandByPeriod(demandRows),
    genMwByTime: generationMwByPeriod(genRows),
  });
}

export async function collectSnapshotsForSettlementDate(
  settlementDate: string
): Promise<Record<string, unknown>[]> {
  const periods = listSettlementPeriods(settlementDate);
  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;
  const ciFrom = from.toISOString().replace(".000Z", "Z");
  const ciTo = to.toISOString().replace(".000Z", "Z");

  const [carbon, prices, demandRows, genRows] = await Promise.all([
    settledValue(() => fetchCarbonWindows(ciFrom, ciTo), emptyCarbonWindows()),
    settledValue(() => fetchSystemPrices(settlementDate), [] as ElexonSystemPrice[]),
    settledValue(
      () => fetchElexonWindow<ElexonDemand>("ITSDO", from.toISOString(), to.toISOString()),
      []
    ),
    settledValue(
      () => fetchElexonWindow<ElexonGeneration>("AGPT", from.toISOString(), to.toISOString()),
      []
    ),
  ]);

  return buildSnapshotRowsForPeriods(periods, {
    intensityByTime: carbon.intensityByTime,
    mixByTime: carbon.mixByTime,
    priceByTime: priceByPeriod(prices),
    demandByTime: demandByPeriod(demandRows),
    genMwByTime: generationMwByPeriod(genRows),
  });
}

export function currentHalfHourTimestamp(now: Date): string {
  return hourKey(getSettlementPeriod(now).startUtc);
}
