import { describe, expect, it } from "vitest";
import {
  buildEiaSeriesUrl,
  dedupePriceRows,
  EIA_COMMODITIES,
  eiaApiKeyFromEnv,
  eiaCronWindow,
  isOilPriceTtfCronSlot,
  isRequiredPriceCronSource,
  latestCommodityDate,
  OILPRICE_COMMODITIES,
  OILPRICE_TTF_CRON_UTC_HOUR,
  rejectStoredPriceRows,
  shouldFetchOilPriceTtf,
} from "@/lib/ingest/collect-prices";

describe("OilPriceAPI quota", () => {
  it("fetches only Dutch TTF, never EIA-covered commodities", () => {
    expect(OILPRICE_COMMODITIES).toEqual([
      { code: "DUTCH_TTF_EUR", commodity: "eu_ttf", unit: "EUR/MWh", currency: "EUR" },
    ]);
    expect(OILPRICE_COMMODITIES).toHaveLength(1);

    expect(EIA_COMMODITIES.map((row) => row.commodity)).toEqual([
      "brent_crude",
      "wti_crude",
      "henry_hub_gas",
    ]);
  });

  it("only allows OilPriceAPI on the 00:30 UTC cron-prices slot", () => {
    expect(OILPRICE_TTF_CRON_UTC_HOUR).toBe(0);
    expect(isOilPriceTtfCronSlot(0)).toBe(true);
    expect(isOilPriceTtfCronSlot(6)).toBe(false);
    expect(isOilPriceTtfCronSlot(12)).toBe(false);
    expect(isOilPriceTtfCronSlot(18)).toBe(false);
    expect(isOilPriceTtfCronSlot(1)).toBe(false);
  });

  it("skips OilPriceAPI when today's eu_ttf row already exists", () => {
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-27", 0)).toBe(false);
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-27 00:00:00", 0)).toBe(false);
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-26", 0)).toBe(true);
    expect(shouldFetchOilPriceTtf("2026-09-27", null, 0)).toBe(true);
  });

  it("does not retry OilPriceAPI on later UTC slots even if today's row is missing", () => {
    expect(shouldFetchOilPriceTtf("2026-09-27", null, 6)).toBe(false);
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-26", 12)).toBe(false);
    expect(shouldFetchOilPriceTtf("2026-09-27", "2026-09-26", 18)).toBe(false);
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

describe("commodity price ingest helpers", () => {
  it("builds a ranged EIA URL and rejects DEMO_KEY", () => {
    expect(eiaApiKeyFromEnv("DEMO_KEY")).toBeNull();
    expect(eiaApiKeyFromEnv("real-key")).toBe("real-key");
    expect(eiaCronWindow(new Date("2026-09-27T12:00:00.000Z"))).toEqual({
      from: "2026-08-28",
      to: "2026-09-27",
    });
    expect(buildEiaSeriesUrl("PET.RBRTE.D", "real-key", "2026-08-28", "2026-09-27")).toContain(
      "start=2026-08-28"
    );
    expect(isRequiredPriceCronSource("eia")).toBe(true);
    expect(isRequiredPriceCronSource("worldbank")).toBe(true);
    expect(isRequiredPriceCronSource("nationalgas")).toBe(false);
  });

  it("dedupes on commodity and date, last write wins", () => {
    const rows = dedupePriceRows([
      {
        date: "2026-09-22 00:00:00",
        commodity: "brent_crude",
        price: 70,
        currency: "USD",
        unit: "$/BBL",
      },
      {
        date: "2026-09-22",
        commodity: "brent_crude",
        price: 71.5,
        currency: "USD",
        unit: "$/BBL",
      },
      {
        date: "2026-09-22",
        commodity: "wti_crude",
        price: 66,
        currency: "USD",
        unit: "$/BBL",
      },
    ]);

    expect(rows).toEqual([
      {
        date: "2026-09-22",
        commodity: "brent_crude",
        price: 71.5,
        currency: "USD",
        unit: "$/BBL",
      },
      {
        date: "2026-09-22",
        commodity: "wti_crude",
        price: 66,
        currency: "USD",
        unit: "$/BBL",
      },
    ]);
  });

  it("skips rows already stored for the same commodity and date", () => {
    expect(
      rejectStoredPriceRows(
        [
          {
            date: "2026-09-22",
            commodity: "brent_crude",
            price: 71.5,
            currency: "USD",
            unit: "$/BBL",
          },
          {
            date: "2026-09-23",
            commodity: "brent_crude",
            price: 72,
            currency: "USD",
            unit: "$/BBL",
          },
        ],
        [{ commodity: "brent_crude", date: "2026-09-22 00:00:00" }]
      )
    ).toEqual([
      {
        date: "2026-09-23",
        commodity: "brent_crude",
        price: 72,
        currency: "USD",
        unit: "$/BBL",
      },
    ]);
  });
});
