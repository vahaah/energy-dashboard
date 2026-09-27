import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildEiaSeriesUrl,
  dedupePriceRows,
  EIA_BACKFILL_CRON_UTC_HOUR,
  EIA_BACKFILL_LOOKBACK_DAYS,
  EIA_COMMODITIES,
  EIA_CRON_LOOKBACK_DAYS,
  eiaApiKeyFromEnv,
  eiaCronLookbackDays,
  eiaCronWindow,
  isEiaBackfillCronSlot,
  isOilPriceTtfCronSlot,
  isRequiredPriceCronSource,
  latestCommodityDate,
  OILPRICE_COMMODITIES,
  OILPRICE_TTF_CRON_UTC_HOUR,
  rejectStoredPriceRows,
  selectCronWorldBankRows,
  selectPriceRowsForIngest,
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
    expect(buildEiaSeriesUrl("PET.RBRTE.D", "real-key", "2025-08-23", "2026-09-27")).toContain(
      "length=5000"
    );
    expect(isRequiredPriceCronSource("eia")).toBe(true);
    expect(isRequiredPriceCronSource("worldbank")).toBe(true);
    expect(isRequiredPriceCronSource("nationalgas")).toBe(false);
  });

  it("heals a 400-day EIA window on the first cron-prices slot after 00:00 UTC", () => {
    expect(EIA_BACKFILL_CRON_UTC_HOUR).toBe(OILPRICE_TTF_CRON_UTC_HOUR);
    expect(EIA_BACKFILL_CRON_UTC_HOUR).toBe(0);
    expect(isEiaBackfillCronSlot(0)).toBe(true);
    expect(isEiaBackfillCronSlot(6)).toBe(false);
    expect(isEiaBackfillCronSlot(12)).toBe(false);
    expect(isEiaBackfillCronSlot(18)).toBe(false);
    expect(eiaCronLookbackDays(0)).toBe(EIA_BACKFILL_LOOKBACK_DAYS);
    expect(eiaCronLookbackDays(6)).toBe(EIA_CRON_LOOKBACK_DAYS);
    expect(eiaCronLookbackDays(12)).toBe(30);
    expect(eiaCronLookbackDays(18)).toBe(30);
    expect(eiaCronWindow(new Date("2026-09-27T00:30:00.000Z"))).toEqual({
      from: "2025-08-23",
      to: "2026-09-27",
    });
    expect(eiaCronWindow(new Date("2026-09-27T06:30:00.000Z"))).toEqual({
      from: "2026-08-28",
      to: "2026-09-27",
    });
    expect(eiaCronWindow(new Date("2026-09-27T18:30:00.000Z")).from).toBe("2026-08-28");
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

  it("writes World Bank eu_natural_gas even when 2025-06-01 is already stored", () => {
    const worldBank = {
      date: "2025-06-01",
      commodity: "eu_natural_gas",
      price: 11.84,
      currency: "USD",
      unit: "$/MMBTU",
    };
    const storedEia = {
      date: "2025-06-01",
      commodity: "brent_crude",
      price: 70,
      currency: "USD",
      unit: "$/BBL",
    };
    const freshEia = {
      date: "2025-06-02",
      commodity: "brent_crude",
      price: 71,
      currency: "USD",
      unit: "$/BBL",
    };
    const stored = [
      { commodity: "eu_natural_gas", date: "2025-06-01" },
      { commodity: "brent_crude", date: "2025-06-01" },
    ];

    expect(selectPriceRowsForIngest([worldBank, storedEia, freshEia], stored)).toEqual([
      worldBank,
      freshEia,
    ]);
    expect(selectCronWorldBankRows([worldBank], stored)).toEqual([worldBank]);
    expect(rejectStoredPriceRows([worldBank], stored)).toEqual([]);
  });

  it("wires the script helper and cron to overwrite stored World Bank keys", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/backfill-commodities.ts"), "utf8");
    const cron = readFileSync(resolve(process.cwd(), "src/app/api/cron-prices/route.ts"), "utf8");

    expect(script).toContain("selectPriceRowsForIngest");
    expect(script).not.toContain("rejectStoredPriceRows");
    expect(cron).toContain("selectCronWorldBankRows");
    expect(cron).not.toContain("rejectStoredPriceRows");
  });
});
