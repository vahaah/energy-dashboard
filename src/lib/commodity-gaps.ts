import {
  isMonthStartDate,
  isPublicCommodity,
  PUBLIC_COMMODITIES,
  type PublicCommodity,
} from "@/lib/commodity-series";
import { addUtcDays } from "@/lib/london-time";

export const COMMODITY_CADENCE = {
  brent_crude: "eia_weekday",
  wti_crude: "eia_weekday",
  henry_hub_gas: "eia_weekday",
  eu_natural_gas: "monthly",
  lng_asia: "monthly",
  gb_gas_sap: "daily",
} as const;

export type CommodityCadence = (typeof COMMODITY_CADENCE)[PublicCommodity];

export type CommodityGapReport = {
  commodity: string;
  cadence: CommodityCadence | "unknown";
  firstDate: string | null;
  lastDate: string | null;
  count: number;
  missingDates: string[];
  strayDates: string[];
};

export function eachDateInclusive(from: string, to: string): string[] {
  if (from > to) {
    return [];
  }

  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return dates;
}

export function weekdayIndex(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isWeekdayDate(date: string): boolean {
  const day = weekdayIndex(date);
  return day !== 0 && day !== 6;
}

export function monthStartOnOrAfter(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function nextMonthStart(date: string): string {
  const year = Number.parseInt(date.slice(0, 4), 10);
  const month = Number.parseInt(date.slice(5, 7), 10);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return `${String(next.year).padStart(4, "0")}-${String(next.month).padStart(2, "0")}-01`;
}

export function expectedDatesForCadence(
  cadence: CommodityCadence,
  from: string,
  to: string
): string[] {
  switch (cadence) {
    case "eia_weekday":
      return eachDateInclusive(from, to).filter((date) => isWeekdayDate(date));
    case "daily":
      return eachDateInclusive(from, to);
    case "monthly": {
      const dates: string[] = [];
      let cursor = monthStartOnOrAfter(from);
      const last = monthStartOnOrAfter(to);
      while (cursor <= last) {
        dates.push(cursor);
        cursor = nextMonthStart(cursor);
      }
      return dates;
    }
    default: {
      const exhaustive: never = cadence;
      return exhaustive;
    }
  }
}

export function isOnCadence(date: string, cadence: CommodityCadence): boolean {
  switch (cadence) {
    case "eia_weekday":
      return isWeekdayDate(date);
    case "daily":
      return true;
    case "monthly":
      return isMonthStartDate(date);
    default: {
      const exhaustive: never = cadence;
      return exhaustive;
    }
  }
}

export function cadenceForCommodity(commodity: string): CommodityCadence | "unknown" {
  if (!isPublicCommodity(commodity)) {
    return "unknown";
  }
  return COMMODITY_CADENCE[commodity];
}

export function reportCommodityGaps(
  rows: Array<{ commodity: string; date: string }>,
  commodity: string,
  from: string,
  to: string
): CommodityGapReport {
  const cadence = cadenceForCommodity(commodity);
  const dates = rows
    .filter((row) => row.commodity === commodity)
    .map((row) => row.date.slice(0, 10))
    .sort((left, right) => left.localeCompare(right));
  const unique = [...new Set(dates)];
  const firstDate = unique[0] ?? null;
  const lastDate = unique.at(-1) ?? null;

  if (cadence === "unknown") {
    return {
      commodity,
      cadence,
      firstDate,
      lastDate,
      count: unique.length,
      missingDates: [],
      strayDates: unique,
    };
  }

  const have = new Set(unique);
  return {
    commodity,
    cadence,
    firstDate,
    lastDate,
    count: unique.length,
    missingDates: expectedDatesForCadence(cadence, from, to).filter((date) => !have.has(date)),
    strayDates: unique.filter((date) => !isOnCadence(date, cadence)),
  };
}

export function reportPublicCommodityGaps(
  rows: Array<{ commodity: string; date: string }>,
  from: string,
  to: string
): CommodityGapReport[] {
  return PUBLIC_COMMODITIES.map((commodity) => reportCommodityGaps(rows, commodity, from, to));
}
