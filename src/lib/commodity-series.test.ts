import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterCanonicalCommodityPrices,
  filterPublicCommodityPrices,
  isCanonicalCommodityPrice,
  isOilPriceApiDailyEuNaturalGas,
  isPublicCommodity,
  OILPRICE_DAILY_EU_NATURAL_GAS_SQL,
  PUBLIC_COMMODITIES,
} from "@/lib/commodity-series";
import { OILPRICE_COMMODITIES, FRED_COMMODITIES } from "@/lib/ingest/collect-prices";

describe("commodity series stay on their own units", () => {
  it("does not let OilPriceAPI TTF share the FRED eu_natural_gas key", () => {
    const oilCommodities = OILPRICE_COMMODITIES.map((row) => row.commodity);
    const fredCommodities = FRED_COMMODITIES.map((row) => row.commodity);

    expect(oilCommodities).not.toContain("eu_natural_gas");
    expect(fredCommodities).not.toContain("eu_ttf");
    expect(OILPRICE_COMMODITIES).toEqual([
      { code: "DUTCH_TTF_EUR", commodity: "eu_ttf", unit: "EUR/MWh", currency: "EUR" },
    ]);
    expect(OILPRICE_COMMODITIES.map((row) => row.commodity)).not.toContain("lng_asia");
    expect(OILPRICE_COMMODITIES.map((row) => row.commodity)).not.toContain("brent_crude");
    expect(
      FRED_COMMODITIES.some((row) => row.commodity === "eu_natural_gas" && row.unit === "$/MMBTU")
    ).toBe(true);
    expect(oilCommodities).not.toContain("gb_gas_sap");
    expect(fredCommodities).not.toContain("gb_gas_sap");
  });

  it("drops leftover OilPriceAPI daily rows labelled as eu_natural_gas", () => {
    const leaked = {
      date: "2026-09-27",
      commodity: "eu_natural_gas",
      price: 81.89,
      currency: "USD",
      unit: "$/MMBtu",
    };
    const fred = {
      date: "2026-09-01",
      commodity: "eu_natural_gas",
      price: 11.4,
      currency: "USD",
      unit: "$/MMBTU",
    };
    const ttf = {
      date: "2026-09-27",
      commodity: "eu_ttf",
      price: 81.89,
      currency: "EUR",
      unit: "EUR/MWh",
    };

    expect(isOilPriceApiDailyEuNaturalGas(leaked)).toBe(true);
    expect(isCanonicalCommodityPrice(leaked)).toBe(false);
    expect(filterCanonicalCommodityPrices([leaked, fred, ttf])).toEqual([fred, ttf]);
    expect(OILPRICE_DAILY_EU_NATURAL_GAS_SQL).toContain("toDayOfMonth(date) != 1");
  });

  it("hides eu_ttf, lng_asia and eu_natural_gas from the public allow-list", () => {
    const brent = {
      date: "2026-09-26",
      commodity: "brent_crude",
      price: 70,
      currency: "USD",
      unit: "$/BBL",
    };
    const ttf = {
      date: "2026-09-27",
      commodity: "eu_ttf",
      price: 81.89,
      currency: "EUR",
      unit: "EUR/MWh",
    };
    const fred = {
      date: "2026-09-01",
      commodity: "eu_natural_gas",
      price: 11.4,
      currency: "USD",
      unit: "$/MMBTU",
    };
    const lng = {
      date: "2026-09-01",
      commodity: "lng_asia",
      price: 10.84,
      currency: "USD",
      unit: "$/MMBTU",
    };

    expect(isPublicCommodity("eu_ttf")).toBe(false);
    expect(isPublicCommodity("lng_asia")).toBe(false);
    expect(isPublicCommodity("eu_natural_gas")).toBe(false);
    expect(PUBLIC_COMMODITIES).toEqual([
      "brent_crude",
      "wti_crude",
      "henry_hub_gas",
      "gb_gas_sap",
    ]);
    expect(filterPublicCommodityPrices([ttf, fred, lng, brent])).toEqual([brent]);
  });

  it("does not request OilPriceAPI or FRED from cron-prices", () => {
    const cron = readFileSync(resolve(process.cwd(), "src/app/api/cron-prices/route.ts"), "utf8");
    expect(cron).not.toContain("fetchOilPriceLatest");
    expect(cron).not.toContain("fetchFredLatest");
    expect(cron).not.toContain("oilpriceapi");
    expect(cron).not.toContain("OIL_PRICE_API_KEY");
    expect(cron).not.toContain("FRED_API_KEY");
    expect(cron).not.toMatch(/OilPriceAPI|FRED/);
  });

  it("does not request OilPriceAPI or FRED from historical price backfill", () => {
    const backfill = readFileSync(resolve(process.cwd(), "scripts/backfill.ts"), "utf8");
    expect(backfill).not.toContain("FRED_COMMODITIES");
    expect(backfill).not.toContain("OILPRICE_COMMODITIES");
    expect(backfill).not.toContain("fetchOilPriceLatest");
    expect(backfill).not.toContain("fetchFredLatest");
    expect(backfill).not.toContain("stlouisfed.org");
    expect(backfill).not.toContain("oilpriceapi");
    expect(backfill).not.toContain("FRED_API_KEY");
    expect(backfill).not.toContain("OIL_PRICE_API_KEY");
    expect(backfill).not.toContain("eu_natural_gas");
    expect(backfill).not.toContain("lng_asia");
    expect(backfill).not.toContain("eu_ttf");
  });

  it("does not mention TTF, JKM or IMF in home page copy", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/dashboard.tsx"), "utf8");
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
    expect(dashboard).not.toMatch(/TTF|JKM|IMF/);
    expect(readme).not.toMatch(/TTF|JKM|IMF/);
  });
});
