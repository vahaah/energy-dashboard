import { describe, expect, it } from "vitest";
import {
  expectedDatesForCadence,
  reportCommodityGaps,
  reportPublicCommodityGaps,
} from "@/lib/commodity-gaps";

describe("commodity gap detection", () => {
  it("expects EIA weekdays, SAP every day, and month-start World Bank rows", () => {
    expect(expectedDatesForCadence("eia_weekday", "2026-09-21", "2026-09-25")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
    expect(expectedDatesForCadence("daily", "2026-09-26", "2026-09-27")).toEqual([
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(expectedDatesForCadence("monthly", "2025-10-15", "2026-01-20")).toEqual([
      "2025-10-01",
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
    ]);
  });

  it("lists missing EIA weekdays and weekend strays", () => {
    const report = reportCommodityGaps(
      [
        { commodity: "brent_crude", date: "2026-09-21" },
        { commodity: "brent_crude", date: "2026-09-23" },
        { commodity: "brent_crude", date: "2026-09-20" },
      ],
      "brent_crude",
      "2026-09-21",
      "2026-09-23"
    );

    expect(report.missingDates).toEqual(["2026-09-22"]);
    expect(report.strayDates).toEqual(["2026-09-20"]);
    expect(report.firstDate).toBe("2026-09-20");
    expect(report.lastDate).toBe("2026-09-23");
  });

  it("flags daily leftover rows on the monthly public series", () => {
    const report = reportCommodityGaps(
      [
        { commodity: "lng_asia", date: "2026-08-01" },
        { commodity: "lng_asia", date: "2026-08-15" },
      ],
      "lng_asia",
      "2026-08-01",
      "2026-09-01"
    );

    expect(report.missingDates).toEqual(["2026-09-01"]);
    expect(report.strayDates).toEqual(["2026-08-15"]);
  });

  it("reports every public series in allow-list order", () => {
    const reports = reportPublicCommodityGaps([], "2026-09-01", "2026-09-02");
    expect(reports.map((report) => report.commodity)).toEqual([
      "brent_crude",
      "wti_crude",
      "henry_hub_gas",
      "eu_natural_gas",
      "lng_asia",
      "gb_gas_sap",
    ]);
  });
});
