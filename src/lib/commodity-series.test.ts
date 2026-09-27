import { describe, expect, it } from "vitest";
import {
  filterCanonicalCommodityPrices,
  isCanonicalCommodityPrice,
  isOilPriceApiDailyEuNaturalGas,
  OILPRICE_DAILY_EU_NATURAL_GAS_SQL,
} from "@/lib/commodity-series";
import { OILPRICE_COMMODITIES, FRED_COMMODITIES } from "@/lib/ingest/collect-prices";

describe("commodity series stay on their own units", () => {
  it("does not let OilPriceAPI TTF share the FRED eu_natural_gas key", () => {
    const oilCommodities = OILPRICE_COMMODITIES.map((row) => row.commodity);
    const fredCommodities = FRED_COMMODITIES.map((row) => row.commodity);

    expect(oilCommodities).not.toContain("eu_natural_gas");
    expect(fredCommodities).not.toContain("eu_ttf");
    expect(OILPRICE_COMMODITIES.some((row) => row.commodity === "eu_ttf" && row.unit === "EUR/MWh")).toBe(
      true
    );
    expect(
      FRED_COMMODITIES.some((row) => row.commodity === "eu_natural_gas" && row.unit === "$/MMBTU")
    ).toBe(true);
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
});
