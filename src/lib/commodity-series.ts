import type { CommodityPrice } from "@/lib/types";

export const PUBLIC_COMMODITIES = [
  "brent_crude",
  "wti_crude",
  "henry_hub_gas",
  "gb_gas_sap",
  "eu_natural_gas",
  "lng_asia",
] as const;

export type PublicCommodity = (typeof PUBLIC_COMMODITIES)[number];

export function isPublicCommodity(value: string): value is PublicCommodity {
  for (const commodity of PUBLIC_COMMODITIES) {
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

export function isMonthStartDate(date: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(date);
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

export function isCanonicalCommodityPrice(row: CommodityPrice): boolean {
  switch (row.commodity) {
    case "eu_ttf":
      return row.currency === "EUR" && normalizeCommodityUnit(row.unit) === "EUR/MWh";
    case "eu_natural_gas":
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

export function filterPublicCommodityPrices<T extends CommodityPrice>(rows: T[]): T[] {
  return filterCanonicalCommodityPrices(rows).filter((row) => isPublicCommodity(row.commodity));
}
