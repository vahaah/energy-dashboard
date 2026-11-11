import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  balancingResourceName,
  costDay,
  dailyChartPoints,
  dayTotalPence,
  financialYearsInRange,
  financialYearsThrough,
  isProvisionalDay,
  mergeCostDays,
  netTradePence,
  sumDaysPence,
  tradeMonthsFromDays,
  tradeMonthsInRange,
} from "@/lib/balancing/aggregate";
import { BALANCING_TINYBIRD_OPS } from "@/lib/balancing/budget";
import { emptyPence, sumCategoryPence } from "@/lib/balancing/categories";
import { BALANCING_DESCRIPTION, BALANCING_TITLE, TRADE_LABEL } from "@/lib/balancing/copy";
import { householdPence } from "@/lib/balancing/household";
import { parseCostRecords, parseTradeDays, priceIndex } from "@/lib/balancing/parse";
import type { BalancingDay, TradeDay } from "@/lib/balancing/types";
import { assertBalancingWindow } from "@/workflows/steps/balancing";

function day(date: string, periods: number, constraints: number, other = 0): BalancingDay {
  const pence = emptyPence();
  pence.constraints = constraints;
  pence.other = other;
  return costDay(date, periods, pence);
}

describe("balancing reconciliation", () => {
  it("makes a day the sum of the six categories and a year the sum of its days", () => {
    const pence = emptyPence();
    pence.energy_imbalance = 100;
    pence.frequency_control = -50;
    pence.positive_reserve = 200;
    pence.negative_reserve = -25;
    pence.constraints = 1_000;
    pence.other = 75;
    const row = costDay("2026-11-09", 48, pence);
    expect(dayTotalPence(row)).toBe(sumCategoryPence(pence));
    expect(dayTotalPence(row)).toBe(1_300);
    const year = [row, day("2026-11-10", 48, 400)];
    expect(sumDaysPence(year)).toBe(dayTotalPence(year[0]!) + dayTotalPence(year[1]!));
  });

  it("sets net trade to imports minus exports and leaves it out of the balancing total", () => {
    expect(netTradePence({ import_pence: 8_000, export_pence: 3_000 })).toBe(5_000);
    const costs = day("2026-11-10", 48, 500);
    expect(dayTotalPence(costs)).toBe(500);
  });

  it("marks a short day provisional and a 46-period clock-change day complete", () => {
    expect(isProvisionalDay(45, 48)).toBe(true);
    expect(costDay("2026-11-09", 45, emptyPence()).provisional).toBe(true);
    expect(costDay("2026-03-29", 46, emptyPence()).provisional).toBe(false);
    expect(costDay("2026-10-25", 50, emptyPence()).provisional).toBe(false);
  });

  it("drops a missing day inside the window instead of writing zero", () => {
    const existing = [day("2026-11-01", 48, 10), day("2026-11-02", 48, 20), day("2026-11-04", 48, 40)];
    const fetched = [day("2026-11-01", 48, 11), day("2026-11-03", 48, 30)];
    const merged = mergeCostDays(existing, "2026-11-01", "2026-11-03", fetched);
    expect(merged.map((row) => row.date)).toEqual(["2026-11-01", "2026-11-03", "2026-11-04"]);
    expect(merged.find((row) => row.date === "2026-11-02")).toBeUndefined();
    expect(merged.every((row) => dayTotalPence(row) !== 0)).toBe(true);
    const chart = dailyChartPoints(merged, "2026-11-01", "2026-11-04");
    const gap = chart.find((point) => point.date === "2026-11-02");
    expect(gap?.gap).toBe(true);
    expect(gap?.total).toBeNull();
    expect(gap?.constraints).toBeNull();
  });

  it("prices imports and exports separately and skips a half-hour with no price", () => {
    const prices = priceIndex([
      { settlementDate: "2026-11-10", settlementPeriod: 1, dataProvider: "APXMIDP", price: 100, volume: 10 },
    ]);
    const parsed = parseTradeDays(
      [
        { settlementDate: "2026-11-10", settlementPeriod: 1, fuelType: "INTFR", generation: 200, publishTime: "2026-11-10T01:00:00Z" },
        { settlementDate: "2026-11-10", settlementPeriod: 1, fuelType: "INTIRL", generation: -100, publishTime: "2026-11-10T01:00:00Z" },
        { settlementDate: "2026-11-10", settlementPeriod: 2, fuelType: "INTFR", generation: 50, publishTime: "2026-11-10T01:30:00Z" },
        { settlementDate: "2026-11-10", settlementPeriod: 1, fuelType: "INTNESO", generation: 999, publishTime: "2026-11-10T01:00:00Z" },
      ],
      prices,
    );
    const row = parsed.days[0];
    expect(row?.provisional).toBe(true);
    const france = row?.countries.find((country) => country.country === "France");
    const ireland = row?.countries.find((country) => country.country === "Northern Ireland");
    expect(france?.import_pence).toBe(1_000_000);
    expect(france?.import_mwh).toBe(100);
    expect(ireland?.export_pence).toBe(500_000);
    expect(row?.countries.some((country) => country.country === "INTNESO")).toBe(false);
    expect(netTradePence({ import_pence: france?.import_pence ?? 0, export_pence: ireland?.export_pence ?? 0 })).toBe(500_000);
  });

  it("rolls trade to months without filling a missing day as zero", () => {
    const complete: TradeDay = {
      date: "2026-11-01",
      expected_periods: 48,
      observed_periods: 48,
      unpriced_periods: 0,
      provisional: false,
      countries: [{ country: "France", import_pence: 100, export_pence: 40, import_mwh: 1, export_mwh: 1 }],
    };
    const months = tradeMonthsFromDays([complete], "2026-11-02");
    expect(months[0]?.provisional).toBe(true);
    expect(months[0]?.countries[0]?.import_pence).toBe(100);
    expect(netTradePence(months[0]?.countries[0] ?? { import_pence: 0, export_pence: 0 })).toBe(60);
  });

  it("uses 2,500 kWh times the current tariff for the household figure", () => {
    expect(householdPence(12.49)).toBe(3_123);
  });

  it("names every NESO resource from 2017-2018 through the current year", () => {
    const years = financialYearsThrough(2017, "2026-11-11");
    expect(years[0]).toBe("2017-2018");
    expect(years.at(-1)).toBe("2026-2027");
    expect(balancingResourceName("2017-2018")).toBe("Daily Balancing Costs 2017-2018");
    expect(balancingResourceName("2026-2027")).toBe("Daily Balancing Costs 2026-2027");
    expect(years).toHaveLength(10);
  });

  it("parses a NESO daily row and does not treat a blank category as zero", () => {
    const parsed = parseCostRecords([
      {
        sett_date: "2026-04-01",
        periods: "48",
        energy_imbalance: "1.25",
        frequency_control: "2",
        positive_reserve: "3",
        negative_reserve: "-4",
        constraints: "5.5",
        other: "0",
      },
      { sett_date: "2026-04-02", periods: "48", constraints: "1" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.pence.energy_imbalance).toBe(125);
    expect(parsed[0]?.pence.negative_reserve).toBe(-400);
    expect(dayTotalPence(parsed[0]!)).toBe(sumCategoryPence(parsed[0]!.pence));
  });

  it("keeps imports and exports when two cables to one country flow opposite ways", () => {
    const prices = priceIndex([
      { settlementDate: "2026-11-10", settlementPeriod: 1, dataProvider: "APXMIDP", price: 100, volume: 10 },
    ]);
    const parsed = parseTradeDays(
      [
        { settlementDate: "2026-11-10", settlementPeriod: 1, fuelType: "INTFR", generation: 200, publishTime: "2026-11-10T01:00:00Z" },
        { settlementDate: "2026-11-10", settlementPeriod: 1, fuelType: "INTIFA2", generation: -200, publishTime: "2026-11-10T01:00:00Z" },
      ],
      prices,
    );
    const france = parsed.days[0]?.countries.find((country) => country.country === "France");
    expect(france?.import_mwh).toBe(100);
    expect(france?.export_mwh).toBe(100);
    expect(france?.import_pence).toBe(1_000_000);
    expect(france?.export_pence).toBe(1_000_000);
  });

  it("marks a day provisional when one interconnector is short of periods", () => {
    const prices = priceIndex(
      Array.from({ length: 48 }, (_, index) => ({
        settlementDate: "2026-11-10",
        settlementPeriod: index + 1,
        dataProvider: "APXMIDP",
        price: 10,
        volume: 1,
      })),
    );
    const row = (fuel: string, periods: number) =>
      Array.from({ length: periods }, (_, index) => ({
        settlementDate: "2026-11-10",
        settlementPeriod: index + 1,
        fuelType: fuel,
        generation: 10,
        publishTime: "2026-11-10T12:00:00Z",
      }));
    const parsed = parseTradeDays([...row("INTFR", 48), ...row("INTNED", 47)], prices);
    expect(parsed.days[0]?.provisional).toBe(true);
    expect(parsed.days[0]?.observed_periods).toBe(47);
  });

  it("keeps a negative market price and does not reject the release", () => {
    const prices = priceIndex([
      { settlementDate: "2026-11-10", settlementPeriod: 1, dataProvider: "APXMIDP", price: -10, volume: 1 },
    ]);
    const parsed = parseTradeDays(
      [{ settlementDate: "2026-11-10", settlementPeriod: 1, fuelType: "INTFR", generation: 100, publishTime: "2026-11-10T01:00:00Z" }],
      prices,
    );
    const france = parsed.days[0]?.countries[0];
    expect(france?.import_pence).toBeLessThan(0);
    expect(france?.import_mwh).toBeGreaterThan(0);
    expect(() =>
      assertBalancingWindow({
        from: "2026-11-10",
        to: "2026-11-10",
        days: [],
        tariffs: [],
        tradeDays: parsed.days,
        tradeFrom: "2026-11-10",
        costsIssuedAt: null,
        tariffsIssuedAt: null,
        unknownFuels: [],
      }),
    ).not.toThrow();
  });

  it("names both financial years when a cost window crosses April", () => {
    expect(financialYearsInRange("2026-03-25", "2026-04-03")).toEqual(["2025-2026", "2026-2027"]);
  });

  it("drops trade from before the range start instead of keeping the whole month", () => {
    const row = (date: string, pence: number): TradeDay => ({
      date,
      expected_periods: 48,
      observed_periods: 48,
      unpriced_periods: 0,
      provisional: false,
      countries: [{ country: "France", import_pence: pence, export_pence: 0, import_mwh: 1, export_mwh: 0 }],
    });
    const months = tradeMonthsInRange(
      [row("2026-08-10", 10), row("2026-08-20", 20), row("2026-09-01", 30)],
      "2026-08-14",
      "2026-11-11",
    );
    expect(months.find((month) => month.month === "2026-08")?.countries[0]?.import_pence).toBe(20);
    expect(months.find((month) => month.month === "2026-09")?.countries[0]?.import_pence).toBe(30);
  });

  it("keeps the trade label free of payment wording and states a zero Tinybird impact", () => {
    expect(TRADE_LABEL).toContain("Market index price (Elexon MID)");
    expect(TRADE_LABEL).toContain("Not an invoice");
    expect(BALANCING_DESCRIPTION.length).toBeLessThanOrEqual(155);
    expect(BALANCING_TITLE).toBe("GB grid balancing costs and BSUoS | Grid");
    expect(TRADE_LABEL.toLowerCase()).not.toMatch(/pay|earn|profit|britain paid|cost of imports/);
    expect(BALANCING_TINYBIRD_OPS).toBe(0);
    const source = readFileSync(resolve(process.cwd(), "src/lib/balancing/fetch.ts"), "utf8");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("tinybird");
  });
});
