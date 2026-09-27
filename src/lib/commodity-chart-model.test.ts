import { describe, expect, it } from "vitest";
import {
  buildCommodityChartSeries,
  commoditySeriesLinePath,
  commodityTime,
  commodityYAxis,
  formatCommodityPointNative,
  indexLogAxis,
  indexToFirstValue,
  scaleAxisLabel,
  scaleCaption,
  tooltipRowsAtTime,
} from "@/lib/commodity-chart-model";
import type { CommodityPrice } from "@/lib/types";

function price(
  commodity: string,
  date: string,
  value: number,
  unit = "$/BBL"
): CommodityPrice {
  return {
    date,
    commodity,
    price: value,
    currency: commodity === "gb_gas_sap" ? "GBP" : "USD",
    unit: commodity === "gb_gas_sap" ? "p/kWh" : unit,
  };
}

describe("indexToFirstValue", () => {
  it("sets the first defined point to 100 and scales the rest", () => {
    expect(indexToFirstValue([40, 50, 60])).toEqual([100, 125, 150]);
  });

  it("skips a missing first value and indexes from the first real observation", () => {
    expect(indexToFirstValue([null, 40, 60])).toEqual([null, 100, 150]);
    expect(indexToFirstValue([null, null, 80, 40])).toEqual([null, null, 100, 50]);
  });

  it("treats zero and negative observations as missing", () => {
    expect(indexToFirstValue([0, 40, 60])).toEqual([null, 100, 150]);
    expect(indexToFirstValue([-8, 40, 20])).toEqual([null, 100, 50]);
  });
});

describe("index log axis", () => {
  it("snaps the domain to base-2 ticks around 100", () => {
    expect(indexLogAxis([80, 100, 200, 1048])).toEqual({
      domain: [50, 1600],
      ticks: [50, 100, 200, 400, 800, 1600],
    });
    expect(indexLogAxis([100])).toEqual({
      domain: [50, 200],
      ticks: [50, 100, 200],
    });
  });

  it("clamps to positive values and ignores non-positive points", () => {
    expect(indexLogAxis([0, -25, 90, 1048])).toEqual({
      domain: [50, 1600],
      ticks: [50, 100, 200, 400, 800, 1600],
    });
    expect(indexLogAxis([0, -1])).toBeNull();
  });

  it("uses a log y-axis only in indexed mode", () => {
    const series = buildCommodityChartSeries(
      [
        price("brent_crude", "2026-01-01", 70),
        price("brent_crude", "2026-01-02", 0),
        price("brent_crude", "2026-01-03", -4),
        price("brent_crude", "2026-01-04", 77),
        price("henry_hub_gas", "2026-01-01", 3, "$/MMBTU"),
        price("henry_hub_gas", "2026-01-23", 30.72, "$/MMBTU"),
      ],
      ["brent_crude", "henry_hub_gas"],
      "index"
    );
    const brent = series.find((entry) => entry.commodity === "brent_crude");

    expect(brent?.points.map((point) => point.date)).toEqual(["2026-01-01", "2026-01-04"]);
    expect(commodityYAxis("index", series)).toEqual({
      scale: "log",
      domain: [100, 1600],
      ticks: [100, 200, 400, 800, 1600],
    });
    expect(commodityYAxis("native", series)).toEqual({
      scale: "auto",
      domain: undefined,
      ticks: undefined,
    });
  });
});

describe("commodity chart series continuity", () => {
  it("draws one path per weekly and monthly series from first to last date", () => {
    const rows = [
      price("brent_crude", "2026-03-03", 70),
      price("gb_gas_sap", "2026-03-03", 6),
      price("gb_gas_sap", "2026-03-04", 6.1),
      price("gb_gas_sap", "2026-03-05", 6.2),
      price("gb_gas_sap", "2026-03-06", 6.0),
      price("gb_gas_sap", "2026-03-07", 5.9),
      price("gb_gas_sap", "2026-03-08", 5.8),
      price("gb_gas_sap", "2026-03-09", 5.7),
      price("brent_crude", "2026-03-10", 71),
      price("gb_gas_sap", "2026-03-10", 5.6),
      price("lng_asia", "2025-10-01", 12, "$/MMBTU"),
      price("gb_gas_sap", "2026-04-01", 5.5),
      price("lng_asia", "2026-03-01", 14, "$/MMBTU"),
      price("brent_crude", "2026-09-22", 72),
      price("lng_asia", "2026-09-01", 16, "$/MMBTU"),
    ];

    const series = buildCommodityChartSeries(
      rows,
      ["brent_crude", "lng_asia", "gb_gas_sap"],
      "native"
    );
    const weekly = series.find((entry) => entry.commodity === "brent_crude");
    const monthly = series.find((entry) => entry.commodity === "lng_asia");

    expect(weekly?.points.map((point) => point.date)).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-09-22",
    ]);
    expect(monthly?.points.map((point) => point.date)).toEqual([
      "2025-10-01",
      "2026-03-01",
      "2026-09-01",
    ]);

    const weeklyPath = commoditySeriesLinePath(weekly?.points ?? []);
    const monthlyPath = commoditySeriesLinePath(monthly?.points ?? []);
    const weeklyFirst = weekly?.points[0];
    const weeklyLast = weekly?.points.at(-1);
    const monthlyFirst = monthly?.points[0];
    const monthlyLast = monthly?.points.at(-1);

    expect(weeklyPath.match(/M/g)).toEqual(["M"]);
    expect(monthlyPath.match(/M/g)).toEqual(["M"]);
    expect(weeklyPath.startsWith(`M${weeklyFirst?.time},${weeklyFirst?.value}`)).toBe(true);
    expect(weeklyPath.endsWith(`L${weeklyLast?.time},${weeklyLast?.value}`)).toBe(true);
    expect(monthlyPath.startsWith(`M${monthlyFirst?.time},${monthlyFirst?.value}`)).toBe(true);
    expect(monthlyPath.endsWith(`L${monthlyLast?.time},${monthlyLast?.value}`)).toBe(true);
  });

  it("indexes each series from its first value in the selected range", () => {
    const series = buildCommodityChartSeries(
      [
        price("brent_crude", "2026-03-03", 70),
        price("brent_crude", "2026-03-10", 77),
        price("lng_asia", "2026-03-01", 10, "$/MMBTU"),
        price("lng_asia", "2026-04-01", 12, "$/MMBTU"),
      ],
      ["brent_crude", "lng_asia"],
      "index"
    );
    const brent = series.find((entry) => entry.commodity === "brent_crude");
    const lng = series.find((entry) => entry.commodity === "lng_asia");

    expect(brent?.points[0]?.value).toBe(100);
    expect(brent?.points[1]?.value).toBeCloseTo(110);
    expect(brent?.points[0]?.native).toBe(70);
    expect(lng?.points[0]?.value).toBe(100);
    expect(lng?.points[1]?.value).toBe(120);
  });
});

describe("commodity native tooltip values", () => {
  it("formats the stored native price and unit, not the index", () => {
    expect(
      formatCommodityPointNative({
        commodity: "brent_crude",
        native: 72.45,
        unit: "$/bbl",
      })
    ).toBe("72.45 $/bbl");
    expect(scaleCaption("index")).toBe("Indexed, start = 100 (log scale)");
    expect(scaleAxisLabel("index")).toBe("Indexed, start = 100 (log scale)");
  });

  it("joins tooltip rows by timestamp instead of series index", () => {
    const series = buildCommodityChartSeries(
      [
        price("brent_crude", "2026-03-03", 70),
        price("brent_crude", "2026-03-10", 77),
        price("lng_asia", "2026-03-01", 14, "$/MMBTU"),
        price("lng_asia", "2026-04-01", 16, "$/MMBTU"),
      ],
      ["brent_crude", "lng_asia"],
      "index"
    );

    const rows = tooltipRowsAtTime(series, commodityTime("2026-03-05"));
    expect(rows.map((row) => [row.commodity, row.date, row.native])).toEqual([
      ["brent_crude", "2026-03-03", 70],
      ["lng_asia", "2026-03-01", 14],
    ]);
    expect(rows[0]?.native).not.toBe(100);
  });
});
