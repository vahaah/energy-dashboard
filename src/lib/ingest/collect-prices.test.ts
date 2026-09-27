import { describe, expect, it } from "vitest";
import {
  EIA_COMMODITIES,
  latestCommodityDate,
  OILPRICE_COMMODITIES,
  shouldFetchOilPriceTtf,
} from "@/lib/ingest/collect-prices";

describe("OilPriceAPI quota", () => {
  it("fetches only Dutch TTF, never EIA-covered commodities", () => {
    expect(OILPRICE_COMMODITIES).toEqual([
      { code: "DUTCH_TTF_EUR", commodity: "eu_ttf", unit: "EUR/MWh", currency: "EUR" },
    ]);
    expect(OILPRICE_COMMODITIES).toHaveLength(1);

    const eiaCommodities = EIA_COMMODITIES.map((row) => row.commodity);
    expect(eiaCommodities).toEqual(["brent_crude", "wti_crude", "henry_hub_gas"]);
    expect(OILPRICE_COMMODITIES.some((row) => eiaCommodities.includes(row.commodity))).toBe(
      false
    );
  });

  it("skips OilPriceAPI when today's eu_ttf row already exists", () => {
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-27")).toBe(false);
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-27 00:00:00")).toBe(false);
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-26")).toBe(true);
    expect(shouldFetchOilPriceTtf("2026-09-27", null)).toBe(true);
  });

  it("reads the latest eu_ttf date from pipe rows", () => {
    expect(
      latestCommodityDate(
        [
          { commodity: "brent_crude", date: "2026-09-26" },
          { commodity: "eu_ttf", date: "2026-09-27 00:00:00" },
        ],
        "eu_ttf"
      )
    ).toBe("2026-09-27");
    expect(latestCommodityDate([], "eu_ttf")).toBeNull();
  });
});
