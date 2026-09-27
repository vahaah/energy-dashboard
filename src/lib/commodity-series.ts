import type { CommodityPrice } from "@/lib/types";

export const PUBLIC_COMMODITIES = [
  "brent_crude",
  "wti_crude",
  "henry_hub_gas",
  "eu_natural_gas",
  "lng_asia",
  "gb_gas_sap",
] as const;

export type PublicCommodity = (typeof PUBLIC_COMMODITIES)[number];

export const MONTHLY_PUBLIC_COMMODITIES = ["eu_natural_gas", "lng_asia"] as const;

export function isPublicCommodity(value: string): value is PublicCommodity {
  for (const commodity of PUBLIC_COMMODITIES) {
    if (commodity === value) {
      return true;
    }
  }
  return false;
}

export function isMonthlyPublicCommodity(value: string): boolean {
  for (const commodity of MONTHLY_PUBLIC_COMMODITIES) {
    if (commodity === value) {
      return true;
    }
  }
  return false;
}

export const OILPRICE_DAILY_EU_NATURAL_GAS_SQL = [
  "commodity = 'eu_natural_gas'",
  "AND toDayOfMonth(date) != 1",
].join(" ");

export const STRAY_DAILY_MONTHLY_SQL = [
  "commodity IN ('eu_natural_gas', 'lng_asia')",
  "AND toDayOfMonth(date) != 1",
].join(" ");

export function isMonthStartDate(date: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(date.slice(0, 10));
}

export function normalizeCommodityUnit(unit: string): string {
  return unit.replaceAll("MMBtu", "MMBTU");
}

export function isOilPriceApiDailyEuNaturalGas(row: {
  commodity: string;
  date: string;
}): boolean {
  return row.commodity === "eu_natural_gas" && !isMonthStartDate(row.date);
}

export function isStrayDailyMonthlyCommodity(row: {
  commodity: string;
  date: string;
}): boolean {
  return isMonthlyPublicCommodity(row.commodity) && !isMonthStartDate(row.date);
}

export function isCanonicalCommodityPrice(row: CommodityPrice): boolean {
  switch (row.commodity) {
    case "eu_ttf":
      return row.currency === "EUR" && normalizeCommodityUnit(row.unit) === "EUR/MWh";
    case "eu_natural_gas":
    case "lng_asia":
      return (
        row.currency === "USD" &&
        normalizeCommodityUnit(row.unit) === "$/MMBTU" &&
        isMonthStartDate(row.date)
      );
    case "gb_gas_sap":
      return row.currency === "GBP" && row.unit === "p/kWh";
    default:
      return true;
  }
}

export function filterCanonicalCommodityPrices<T extends CommodityPrice>(rows: T[]): T[] {
  return rows.filter((row) => isCanonicalCommodityPrice(row));
}

/** Homepage, /api/prices, and any public export. Drops leftover daily monthly rows. */
export function filterPublicCommodityPrices<T extends CommodityPrice>(rows: T[]): T[] {
  return filterCanonicalCommodityPrices(rows).filter((row) => isPublicCommodity(row.commodity));
}
