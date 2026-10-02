import { fetchJson, type CollectionResult, type SourceStatus } from "@/lib/http";
import { elexonPublishWindow } from "@/lib/ingest/collect-grid";
import {
  addUtcDays,
  formatTinybirdDateTime,
  getLondonDate,
  parseUtcDateTime,
} from "@/lib/london-time";
import { listSettlementPeriods, settlementPeriodToUtc } from "@/lib/settlement-period";

type FuelInstRow = {
  startTime: string;
  fuelType: string;
  generation: number;
};

type NesoRecord = {
  SETTLEMENT_DATE: string;
  SETTLEMENT_PERIOD: string | number;
  FORECAST_ACTUAL_INDICATOR?: string;
  EMBEDDED_SOLAR_GENERATION?: string | number;
  EMBEDDED_WIND_GENERATION?: string | number;
};

type PvLiveResponse = {
  data: Array<[number, string, number | null]>;
};

export function fuelInstRowsToIngest(
  rows: FuelInstRow[]
): Record<string, unknown>[] {
  return rows.map((row) => ({
    timestamp: formatTinybirdDateTime(parseUtcDateTime(row.startTime)),
    fuel_type: row.fuelType.toLowerCase(),
    generation_mw: row.generation,
    source: "fuelinst",
  }));
}

export function nesoRecordsToIngest(
  records: NesoRecord[],
  fuel: "embedded_wind" | "embedded_solar" = "embedded_wind",
  now?: Date
): Record<string, unknown>[] {
  const preferred = new Map<string, { indicator: string; value: number; timestamp: string }>();

  for (const record of records) {
    const settlementDate = record.SETTLEMENT_DATE.slice(0, 10);
    const settlementPeriod = Number(record.SETTLEMENT_PERIOD);
    if (!Number.isFinite(settlementPeriod) || settlementPeriod < 1) {
      continue;
    }

    const raw =
      fuel === "embedded_wind"
        ? record.EMBEDDED_WIND_GENERATION
        : record.EMBEDDED_SOLAR_GENERATION;
    if (raw == null || raw === "") {
      continue;
    }

    const value = typeof raw === "number" ? raw : Number.parseFloat(raw);
    if (Number.isNaN(value)) {
      continue;
    }

    const startUtc = settlementPeriodToUtc(settlementDate, settlementPeriod);
    if (now && startUtc.getTime() > now.getTime()) {
      continue;
    }

    const timestamp = formatTinybirdDateTime(startUtc);
    const indicator = record.FORECAST_ACTUAL_INDICATOR ?? "F";
    const existing = preferred.get(timestamp);
    if (!existing || (existing.indicator !== "A" && indicator === "A")) {
      preferred.set(timestamp, { indicator, value, timestamp });
    }
  }

  return Array.from(preferred.values()).map((row) => ({
    timestamp: row.timestamp,
    fuel_type: fuel,
    generation_mw: row.value,
    source: "neso",
  }));
}

export function pvLiveRowsToIngest(
  rows: PvLiveResponse["data"],
  now?: Date
): Record<string, unknown>[] {
  return rows
    .filter(([, datetimeGmt, generation]) => {
      if (generation == null || Number.isNaN(generation)) {
        return false;
      }
      if (!now) {
        return true;
      }
      return parseUtcDateTime(datetimeGmt).getTime() <= now.getTime();
    })
    .map(([, datetimeGmt, generation]) => ({
      timestamp: formatTinybirdDateTime(parseUtcDateTime(datetimeGmt)),
      fuel_type: "embedded_solar",
      generation_mw: generation,
      source: "pvlive",
    }));
}

export type { CollectionResult };

/** Hourly cron look-back. ReplacingMergeTree(timestamp, fuel_type) makes repeats idempotent. */
export const FUELINST_RECENT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// generation_5min is long-format ReplacingMergeTree on (timestamp, fuel_type).
// A failed source emits no rows, so it cannot overwrite another fuel's values.
export function mergeSettledGeneration(parts: Array<{
  source: string;
  rows?: Record<string, unknown>[];
  error?: string;
}>): CollectionResult {
  const rows: Record<string, unknown>[] = [];
  const sources: SourceStatus[] = [];

  for (const part of parts) {
    if (part.error) {
      sources.push({ source: part.source, ok: false, error: part.error });
      continue;
    }

    const partRows = part.rows ?? [];
    rows.push(...partRows);
    sources.push({ source: part.source, ok: true, rows: partRows.length });
  }

  return { rows, sources };
}

async function settleSource<T>(
  source: string,
  work: () => Promise<T>,
  toRows: (value: T) => Record<string, unknown>[]
): Promise<{ source: string; rows?: Record<string, unknown>[]; error?: string }> {
  try {
    return { source, rows: toRows(await work()) };
  } catch (error) {
    return {
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function collectRecentGeneration(now: Date): Promise<CollectionResult> {
  const from = new Date(now.getTime() - FUELINST_RECENT_LOOKBACK_MS);
  const today = getLondonDate(now);
  const yesterday = addUtcDays(today, -1);
  const pvFrom = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const nesoSql = [
    'SELECT "SETTLEMENT_DATE","SETTLEMENT_PERIOD","FORECAST_ACTUAL_INDICATOR",',
    '"EMBEDDED_SOLAR_GENERATION","EMBEDDED_WIND_GENERATION"',
    'FROM "177f6fa4-ae49-4182-81ea-0c6b35f26ca6"',
    `WHERE "SETTLEMENT_DATE" IN ('${yesterday}','${today}')`,
    'ORDER BY "SETTLEMENT_DATE","SETTLEMENT_PERIOD"',
  ].join(" ");

  const parts = await Promise.all([
    settleSource(
      "fuelinst",
      () =>
        fetchJson<FuelInstRow[]>(
          `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream?publishDateTimeFrom=${from.toISOString()}&publishDateTimeTo=${now.toISOString()}`
        ),
      (rows) => fuelInstRowsToIngest(rows ?? [])
    ),
    settleSource(
      "neso",
      () =>
        fetchJson<{ result?: { records?: NesoRecord[] } }>(
          `https://api.neso.energy/api/3/action/datastore_search_sql?sql=${encodeURIComponent(nesoSql)}`
        ),
      (json) => nesoRecordsToIngest(json.result?.records ?? [], "embedded_wind", now)
    ),
    settleSource(
      "pvlive",
      () =>
        fetchJson<PvLiveResponse>(
          `https://api.pvlive.uk/pvlive/api/v4/gsp/0?start=${pvFrom.toISOString()}&end=${now.toISOString()}`
        ),
      (json) => pvLiveRowsToIngest(json.data ?? [], now)
    ),
  ]);

  return mergeSettledGeneration(parts);
}

export async function collectGenerationForSettlementDate(
  settlementDate: string,
  now?: Date
): Promise<CollectionResult> {
  const periods = listSettlementPeriods(settlementDate);
  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;
  const publish = elexonPublishWindow(from, to, now);

  const nesoSql = [
    'SELECT "SETTLEMENT_DATE","SETTLEMENT_PERIOD","FORECAST_ACTUAL_INDICATOR",',
    '"EMBEDDED_SOLAR_GENERATION","EMBEDDED_WIND_GENERATION"',
    'FROM "177f6fa4-ae49-4182-81ea-0c6b35f26ca6"',
    `WHERE "SETTLEMENT_DATE"='${settlementDate}'`,
    'ORDER BY "SETTLEMENT_PERIOD"',
  ].join(" ");

  const parts = await Promise.all([
    settleSource(
      "fuelinst",
      () =>
        fetchJson<FuelInstRow[]>(
          `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream?publishDateTimeFrom=${publish.fromIso}&publishDateTimeTo=${publish.toIso}`
        ),
      (rows) => fuelInstRowsToIngest(rows ?? [])
    ),
    settleSource(
      "neso",
      () =>
        fetchJson<{ result?: { records?: NesoRecord[] } }>(
          `https://api.neso.energy/api/3/action/datastore_search_sql?sql=${encodeURIComponent(nesoSql)}`
        ),
      (json) => nesoRecordsToIngest(json.result?.records ?? [], "embedded_wind", now)
    ),
    settleSource(
      "pvlive",
      () =>
        fetchJson<PvLiveResponse>(
          `https://api.pvlive.uk/pvlive/api/v4/gsp/0?start=${from.toISOString()}&end=${to.toISOString()}`
        ),
      (json) => pvLiveRowsToIngest(json.data ?? [], now)
    ),
  ]);

  return mergeSettledGeneration(parts);
}
