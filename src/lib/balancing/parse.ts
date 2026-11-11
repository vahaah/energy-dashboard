import { NESO_COST_COLUMN, emptyPence, type BalancingCategory, type CategoryPence } from "@/lib/balancing/categories";
import { costDay, isIsoDate, isProvisionalDay } from "@/lib/balancing/aggregate";
import { countryForFuel } from "@/lib/balancing/countries";
import { poundsToPence } from "@/lib/balancing/money";
import type { BalancingDay, BalancingTariff, TariffPublication, TradeCountry, TradeDay } from "@/lib/balancing/types";
import { periodsInSettlementDay } from "@/lib/settlement-period";

export type NesoCostRecord = {
  sett_date?: unknown;
  periods?: unknown;
  energy_imbalance?: unknown;
  frequency_control?: unknown;
  positive_reserve?: unknown;
  negative_reserve?: unknown;
  constraints?: unknown;
  other?: unknown;
};

const SQL_FIELD: Record<BalancingCategory, keyof NesoCostRecord> = {
  energy_imbalance: "energy_imbalance",
  frequency_control: "frequency_control",
  positive_reserve: "positive_reserve",
  negative_reserve: "negative_reserve",
  constraints: "constraints",
  other: "other",
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const date = value.slice(0, 10);
  return isIsoDate(date) ? date : null;
}

export function costSql(resourceId: string, from?: string, to?: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(resourceId)) {
    throw new Error("NESO resource id is not a uuid");
  }
  const columns = (Object.keys(SQL_FIELD) as BalancingCategory[])
    .map((category) => `SUM("${NESO_COST_COLUMN[category]}"::numeric) AS ${category}`)
    .join(", ");
  const bounds: string[] = [];
  if (from) {
    if (!isIsoDate(from)) {
      throw new Error("from is not a date");
    }
    bounds.push(`"SETT_DATE" >= '${from}'`);
  }
  if (to) {
    if (!isIsoDate(to)) {
      throw new Error("to is not a date");
    }
    bounds.push(`"SETT_DATE" <= '${to}'`);
  }
  const where = bounds.length > 0 ? ` WHERE ${bounds.join(" AND ")}` : "";
  return `SELECT "SETT_DATE" AS sett_date, COUNT(*) AS periods, ${columns} FROM "${resourceId}"${where} GROUP BY "SETT_DATE" ORDER BY "SETT_DATE"`;
}

export function parseCostRecords(records: readonly NesoCostRecord[]): BalancingDay[] {
  const days: BalancingDay[] = [];
  for (const record of records) {
    const date = isoDate(record.sett_date);
    const periods = finiteNumber(record.periods);
    if (!date || periods == null || periods <= 0) {
      continue;
    }
    const pence = emptyPence();
    let complete = true;
    for (const category of Object.keys(SQL_FIELD) as BalancingCategory[]) {
      const pounds = finiteNumber(record[SQL_FIELD[category]]);
      if (pounds == null) {
        complete = false;
        break;
      }
      pence[category] = poundsToPence(pounds);
    }
    if (!complete) {
      continue;
    }
    days.push(costDay(date, periods, pence));
  }
  return days;
}

export type NesoTariffRecord = {
  Publication?: unknown;
  "Fixed Tariff Title"?: unknown;
  "Published Date"?: unknown;
  "Fixed Tariff Start Date"?: unknown;
  "Fixed Tariff End Date"?: unknown;
  "Fixed Tariff_GBP per MWh"?: unknown;
};

function publication(value: unknown): TariffPublication | null {
  if (value === "Final" || value === "Draft") {
    return value;
  }
  return null;
}

export function tariffSql(resourceId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(resourceId)) {
    throw new Error("NESO tariff resource id is not a uuid");
  }
  return `SELECT "Publication", "Fixed Tariff Title", "Published Date", "Fixed Tariff Start Date", "Fixed Tariff End Date", "Fixed Tariff_GBP per MWh" FROM "${resourceId}" ORDER BY "Fixed Tariff Start Date"`;
}

export function parseTariffRecords(records: readonly NesoTariffRecord[]): { tariffs: BalancingTariff[]; skipped: number } {
  const tariffs: BalancingTariff[] = [];
  let skipped = 0;
  for (const record of records) {
    const kind = publication(record.Publication);
    const title = typeof record["Fixed Tariff Title"] === "string" ? record["Fixed Tariff Title"].trim() : "";
    const published = isoDate(record["Published Date"]);
    const from = isoDate(record["Fixed Tariff Start Date"]);
    const to = isoDate(record["Fixed Tariff End Date"]);
    const gbp = finiteNumber(record["Fixed Tariff_GBP per MWh"]);
    if (!kind || !title || !published || !from || !to || gbp == null || to < from) {
      skipped += 1;
      continue;
    }
    tariffs.push({ title, publication: kind, published, from, to, gbp_per_mwh: Math.round(gbp * 100) / 100 });
  }
  tariffs.sort((left, right) => left.from.localeCompare(right.from) || left.title.localeCompare(right.title));
  return { tariffs, skipped };
}

export type FuelHourRow = {
  settlementDate?: unknown;
  settlementPeriod?: unknown;
  fuelType?: unknown;
  generation?: unknown;
  publishTime?: unknown;
};

export type PriceRow = {
  settlementDate?: unknown;
  settlementPeriod?: unknown;
  dataProvider?: unknown;
  price?: unknown;
  volume?: unknown;
};

const HALF_HOUR_MWH = 0.5;

function periodNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed == null || parsed < 1 || parsed > 50 || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

function priceKey(date: string, period: number): string {
  return `${date}:${period}`;
}

/** Latest APXMIDP price for each settlement period. A missing price is absent, not zero. */
export function priceIndex(rows: readonly PriceRow[]): Map<string, number> {
  const best = new Map<string, { price: number; volume: number }>();
  for (const row of rows) {
    if (row.dataProvider != null && row.dataProvider !== "APXMIDP") {
      continue;
    }
    const date = isoDate(row.settlementDate);
    const period = periodNumber(row.settlementPeriod);
    const price = finiteNumber(row.price);
    if (!date || period == null || price == null) {
      continue;
    }
    const volume = finiteNumber(row.volume) ?? 0;
    const key = priceKey(date, period);
    const current = best.get(key);
    if (!current || volume >= current.volume) {
      best.set(key, { price, volume });
    }
  }
  return new Map([...best.entries()].map(([key, value]) => [key, value.price]));
}

type FuelPick = { mw: number; published: string };

/**
 * Half-hourly flow × GB market price.
 * Positive MW is an import. A period with flow and no price is skipped and the day is provisional.
 * A settlement date with no FUELHH rows is not returned.
 */
export function parseTradeDays(fuelRows: readonly FuelHourRow[], prices: ReadonlyMap<string, number>): { days: TradeDay[]; unknownFuels: string[] } {
  const latest = new Map<string, FuelPick>();
  const unknown = new Set<string>();
  for (const row of fuelRows) {
    const fuel = typeof row.fuelType === "string" ? row.fuelType.toUpperCase() : "";
    if (!fuel.startsWith("INT")) {
      continue;
    }
    const country = countryForFuel(fuel);
    if (country == null) {
      continue;
    }
    if (country === fuel) {
      unknown.add(fuel);
    }
    const date = isoDate(row.settlementDate);
    const period = periodNumber(row.settlementPeriod);
    const mw = finiteNumber(row.generation);
    if (!date || period == null || mw == null) {
      continue;
    }
    const key = `${date}:${period}:${fuel}`;
    const published = typeof row.publishTime === "string" ? row.publishTime : "";
    const current = latest.get(key);
    if (!current || published >= current.published) {
      latest.set(key, { mw, published });
    }
  }

  const byDate = new Map<string, Map<number, Map<string, number>>>();
  const periodsByDate = new Map<string, Set<number>>();
  for (const [key, pick] of latest) {
    const [date, periodText, fuel] = key.split(":");
    if (!date || !periodText || !fuel) {
      continue;
    }
    const period = Number(periodText);
    const country = countryForFuel(fuel);
    if (!country) {
      continue;
    }
    const periods = periodsByDate.get(date) ?? new Set<number>();
    periods.add(period);
    periodsByDate.set(date, periods);
    const dateMap = byDate.get(date) ?? new Map<number, Map<string, number>>();
    const periodMap = dateMap.get(period) ?? new Map<string, number>();
    periodMap.set(country, (periodMap.get(country) ?? 0) + pick.mw);
    dateMap.set(period, periodMap);
    byDate.set(date, dateMap);
  }

  const days: TradeDay[] = [];
  for (const [date, dateMap] of byDate) {
    const expected = periodsInSettlementDay(date);
    const observed = periodsByDate.get(date)?.size ?? 0;
    let unpriced = 0;
    const countries = new Map<string, TradeCountry>();
    for (const [period, flows] of dateMap) {
      const price = prices.get(priceKey(date, period));
      for (const [country, mw] of flows) {
        if (mw === 0) {
          continue;
        }
        if (price == null) {
          unpriced += 1;
          continue;
        }
        const row = countries.get(country) ?? {
          country,
          import_pence: 0,
          export_pence: 0,
          import_mwh: 0,
          export_mwh: 0,
        };
        const mwh = Math.abs(mw) * HALF_HOUR_MWH;
        const pence = poundsToPence(mwh * price);
        if (mw > 0) {
          row.import_mwh += mwh;
          row.import_pence += pence;
        } else {
          row.export_mwh += mwh;
          row.export_pence += pence;
        }
        countries.set(country, row);
      }
    }
    days.push({
      date,
      expected_periods: expected,
      observed_periods: observed,
      unpriced_periods: unpriced,
      provisional: isProvisionalDay(observed, expected) || unpriced > 0,
      countries: [...countries.values()].sort((left, right) => left.country.localeCompare(right.country, "en-GB")),
    });
  }
  days.sort((left, right) => left.date.localeCompare(right.date));
  return { days, unknownFuels: [...unknown].sort() };
}
