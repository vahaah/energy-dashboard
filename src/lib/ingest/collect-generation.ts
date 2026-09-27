import { fetchJson } from "@/lib/http";
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
  fuel: "embedded_wind" | "embedded_solar" = "embedded_wind"
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

    const timestamp = formatTinybirdDateTime(
      settlementPeriodToUtc(settlementDate, settlementPeriod)
    );
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
  rows: PvLiveResponse["data"]
): Record<string, unknown>[] {
  return rows
    .filter(([, , generation]) => generation != null && !Number.isNaN(generation))
    .map(([, datetimeGmt, generation]) => ({
      timestamp: formatTinybirdDateTime(parseUtcDateTime(datetimeGmt)),
      fuel_type: "embedded_solar",
      generation_mw: generation,
      source: "pvlive",
    }));
}

export async function collectRecentGeneration(now: Date): Promise<Record<string, unknown>[]> {
  const from = new Date(now.getTime() - 65 * 60 * 1000);
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

  const [fuelInst, neso, pvLive] = await Promise.all([
    fetchJson<FuelInstRow[]>(
      `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream?publishDateTimeFrom=${from.toISOString()}&publishDateTimeTo=${now.toISOString()}`
    ),
    fetchJson<{ result?: { records?: NesoRecord[] } }>(
      `https://api.neso.energy/api/3/action/datastore_search_sql?sql=${encodeURIComponent(nesoSql)}`
    ),
    fetchJson<PvLiveResponse>(
      `https://api.pvlive.uk/pvlive/api/v4/gsp/0?start=${pvFrom.toISOString()}&end=${now.toISOString()}`
    ),
  ]);

  return [
    ...fuelInstRowsToIngest(fuelInst ?? []),
    ...nesoRecordsToIngest(neso.result?.records ?? [], "embedded_wind"),
    ...pvLiveRowsToIngest(pvLive.data ?? []),
  ];
}

export async function collectGenerationForSettlementDate(
  settlementDate: string
): Promise<Record<string, unknown>[]> {
  const periods = listSettlementPeriods(settlementDate);
  const from = periods[0].startUtc;
  const to = periods[periods.length - 1].endUtc;

  const nesoSql = [
    'SELECT "SETTLEMENT_DATE","SETTLEMENT_PERIOD","FORECAST_ACTUAL_INDICATOR",',
    '"EMBEDDED_SOLAR_GENERATION","EMBEDDED_WIND_GENERATION"',
    'FROM "177f6fa4-ae49-4182-81ea-0c6b35f26ca6"',
    `WHERE "SETTLEMENT_DATE"='${settlementDate}'`,
    'ORDER BY "SETTLEMENT_PERIOD"',
  ].join(" ");

  const [fuelInst, neso, pvLive] = await Promise.all([
    fetchJson<FuelInstRow[]>(
      `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST/stream?publishDateTimeFrom=${from.toISOString()}&publishDateTimeTo=${to.toISOString()}`
    ),
    fetchJson<{ result?: { records?: NesoRecord[] } }>(
      `https://api.neso.energy/api/3/action/datastore_search_sql?sql=${encodeURIComponent(nesoSql)}`
    ),
    fetchJson<PvLiveResponse>(
      `https://api.pvlive.uk/pvlive/api/v4/gsp/0?start=${from.toISOString()}&end=${to.toISOString()}`
    ),
  ]);

  return [
    ...fuelInstRowsToIngest(fuelInst ?? []),
    ...nesoRecordsToIngest(neso.result?.records ?? [], "embedded_wind"),
    ...pvLiveRowsToIngest(pvLive.data ?? []),
  ];
}
