import { describe, expect, it } from "vitest";
import {
  buildNationalGasSapCsvUrl,
  commodityChartValue,
  formatSapGbpPerMwh,
  formatSapPencePerTherm,
  GB_GAS_SAP_COMMODITY,
  GB_GAS_SAP_CURRENCY,
  GB_GAS_SAP_UNIT,
  inclusiveDateChunks,
  parseNationalGasSapCsv,
  parseUkGasDay,
  PENCE_PER_KWH_TO_GBP_PER_MWH,
  PENCE_PER_KWH_TO_PENCE_PER_THERM,
  rejectStoredSapDates,
  sapCronWindow,
  sapGbpPerMwh,
  sapPencePerTherm,
} from "@/lib/gb-gas-sap";
import { isCanonicalCommodityPrice } from "@/lib/commodity-series";
import { isRequiredPriceCronSource } from "@/lib/ingest/collect-prices";

const SAMPLE_CSV = [
  "Applicable At,Applicable For,Data Item,Value,Generated Time,Quality Indicator",
  '27/09/2026 12:40:00,20/09/2026,"SAP, Actual Day",6.7474,27/09/2026 12:41:00,L',
  '27/09/2026 12:40:00,21/09/2026,"SAP, Actual Day",6.5474,27/09/2026 12:41:00,L',
  '27/09/2026 12:40:00,26/09/2026,"SAP, Actual Day",6.2201,27/09/2026 12:41:00,L',
].join("\n");

describe("National Gas SAP", () => {
  it("builds the keyless PUBOB603 CSV download URL", () => {
    expect(buildNationalGasSapCsvUrl("2026-09-20", "2026-09-27")).toBe(
      "https://data.nationalgas.com/api/find-gas-data-download?applicableFor=Y&dateFrom=2026-09-20&dateTo=2026-09-27&dateType=GASDAY&latestFlag=Y&ids=PUBOB603&type=CSV"
    );
  });

  it("parses UK gas-day dates and quoted SAP CSV rows", () => {
    expect(parseUkGasDay("26/09/2026")).toBe("2026-09-26");
    expect(parseUkGasDay("26/09/2026 12:40:00")).toBe("2026-09-26");

    const rows = parseNationalGasSapCsv(SAMPLE_CSV);
    expect(rows).toEqual([
      {
        date: "2026-09-20",
        commodity: GB_GAS_SAP_COMMODITY,
        price: 6.7474,
        currency: GB_GAS_SAP_CURRENCY,
        unit: GB_GAS_SAP_UNIT,
      },
      {
        date: "2026-09-21",
        commodity: GB_GAS_SAP_COMMODITY,
        price: 6.5474,
        currency: GB_GAS_SAP_CURRENCY,
        unit: GB_GAS_SAP_UNIT,
      },
      {
        date: "2026-09-26",
        commodity: GB_GAS_SAP_COMMODITY,
        price: 6.2201,
        currency: GB_GAS_SAP_CURRENCY,
        unit: GB_GAS_SAP_UNIT,
      },
    ]);
  });

  it("keeps the last row when the same gas day appears twice", () => {
    const csv = [
      "Applicable At,Applicable For,Data Item,Value,Generated Time,Quality Indicator",
      '27/09/2026 10:00:00,26/09/2026,"SAP, Actual Day",6.1000,27/09/2026 10:01:00,L',
      '27/09/2026 12:40:00,26/09/2026,"SAP, Actual Day",6.2201,27/09/2026 12:41:00,L',
    ].join("\n");

    expect(parseNationalGasSapCsv(csv)).toEqual([
      {
        date: "2026-09-26",
        commodity: GB_GAS_SAP_COMMODITY,
        price: 6.2201,
        currency: GB_GAS_SAP_CURRENCY,
        unit: GB_GAS_SAP_UNIT,
      },
    ]);
  });

  it("converts published p/kWh into trader p/therm and £/MWh", () => {
    expect(PENCE_PER_KWH_TO_PENCE_PER_THERM).toBe(29.3071);
    expect(PENCE_PER_KWH_TO_GBP_PER_MWH).toBe(10);
    expect(sapPencePerTherm(6.2201)).toBeCloseTo(182.293, 3);
    expect(sapGbpPerMwh(6.2201)).toBeCloseTo(62.201, 3);
    expect(formatSapPencePerTherm(6.2201)).toBe("182.3 p/therm");
    expect(formatSapGbpPerMwh(6.2201)).toBe("£62.20/MWh");
    expect(
      commodityChartValue({
        date: "2026-09-26",
        commodity: GB_GAS_SAP_COMMODITY,
        price: 6.2201,
        currency: GB_GAS_SAP_CURRENCY,
        unit: GB_GAS_SAP_UNIT,
      })
    ).toBeCloseTo(182.293, 3);
    expect(
      commodityChartValue({
        date: "2026-09-26",
        commodity: "eu_ttf",
        price: 81.89,
        currency: "EUR",
        unit: "EUR/MWh",
      })
    ).toBe(81.89);
  });

  it("looks back seven London gas days and chunks inclusive backfill ranges", () => {
    expect(sapCronWindow(new Date("2026-09-27T12:00:00.000Z"))).toEqual({
      from: "2026-09-20",
      to: "2026-09-27",
    });
    expect(inclusiveDateChunks("2025-01-01", "2025-07-01", 90)).toEqual([
      { from: "2025-01-01", to: "2025-03-31" },
      { from: "2025-04-01", to: "2025-06-29" },
      { from: "2025-06-30", to: "2025-07-01" },
    ]);
  });

  it("skips gas days already stored and rejects mislabelled SAP rows", () => {
    const rows = parseNationalGasSapCsv(SAMPLE_CSV);
    expect(rejectStoredSapDates(rows, ["2026-09-20", "2026-09-21 00:00:00"]).map((row) => row.date)).toEqual([
      "2026-09-26",
    ]);
    expect(
      isCanonicalCommodityPrice({
        date: "2026-09-26",
        commodity: GB_GAS_SAP_COMMODITY,
        price: 6.2201,
        currency: GB_GAS_SAP_CURRENCY,
        unit: GB_GAS_SAP_UNIT,
      })
    ).toBe(true);
    expect(
      isCanonicalCommodityPrice({
        date: "2026-09-26",
        commodity: GB_GAS_SAP_COMMODITY,
        price: 182.3,
        currency: "GBP",
        unit: "p/therm",
      })
    ).toBe(false);
    expect(isRequiredPriceCronSource("nationalgas")).toBe(false);
    expect(isRequiredPriceCronSource("eia")).toBe(true);
  });
});
