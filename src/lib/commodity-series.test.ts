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

  it("hides eu_ttf from the public commodity allow-list", () => {
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

    expect(isPublicCommodity("eu_ttf")).toBe(false);
    expect(PUBLIC_COMMODITIES).not.toContain("eu_ttf");
    expect(filterPublicCommodityPrices([ttf, fred, brent])).toEqual([fred, brent]);
  });

  it("still ingests OilPriceAPI Dutch TTF via cron-prices", () => {
    expect(OILPRICE_COMMODITIES.some((row) => row.code === "DUTCH_TTF_EUR")).toBe(true);
    const cron = readFileSync(resolve(process.cwd(), "src/app/api/cron-prices/route.ts"), "utf8");
    expect(cron).toContain("fetchOilPriceLatest");
    expect(cron).toContain('ingestSource("oilpriceapi"');
  });

  it("does not mention TTF or JKM in home page copy", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).not.toMatch(/TTF|JKM/);
  });
});
