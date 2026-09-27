import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommodityChart, CommodityNativeTooltip } from "@/components/charts/commodity-chart";
import {
  buildCommodityChartSeries,
  commoditySeriesLinePath,
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
    currency: "USD",
    unit,
  };
}

const MIXED_CADENCE: CommodityPrice[] = [
  price("brent_crude", "2026-03-03", 70),
  price("brent_crude", "2026-03-10", 71),
  price("brent_crude", "2026-09-22", 72),
  price("lng_asia", "2025-10-01", 12, "$/MMBTU"),
  price("lng_asia", "2026-03-01", 14, "$/MMBTU"),
  price("lng_asia", "2026-09-01", 16, "$/MMBTU"),
  price("gb_gas_sap", "2026-03-04", 6.1),
  price("gb_gas_sap", "2026-03-05", 6.2),
  price("gb_gas_sap", "2026-03-06", 6.0),
];

describe("CommodityPriceLines", () => {
  it("renders a single path per weekly and monthly series spanning first to last date", () => {
    const series = buildCommodityChartSeries(
      MIXED_CADENCE,
      ["brent_crude", "lng_asia"],
      "native"
    );
    const weekly = series.find((entry) => entry.commodity === "brent_crude");
    const monthly = series.find((entry) => entry.commodity === "lng_asia");
    const weeklyPath = commoditySeriesLinePath(weekly?.points ?? []);
    const monthlyPath = commoditySeriesLinePath(monthly?.points ?? []);
    const html = renderToStaticMarkup(
      <svg>
        <path data-commodity="brent_crude" d={weeklyPath} />
        <path data-commodity="lng_asia" d={monthlyPath} />
      </svg>
    );
    const source = readFileSync(resolve(import.meta.dirname, "./commodity-chart.tsx"), "utf8");

    expect(weekly?.points[0]?.date).toBe("2026-03-03");
    expect(weekly?.points.at(-1)?.date).toBe("2026-09-22");
    expect(monthly?.points[0]?.date).toBe("2025-10-01");
    expect(monthly?.points.at(-1)?.date).toBe("2026-09-01");
    expect(weeklyPath.match(/M/g)).toEqual(["M"]);
    expect(monthlyPath.match(/M/g)).toEqual(["M"]);
    expect(html.match(/<path /g)).toHaveLength(2);
    expect(html).toContain(`d="${weeklyPath}"`);
    expect(html).toContain(`d="${monthlyPath}"`);
    expect(source).toContain("data={entry.points}");
    expect(source).toContain("connectNulls");
    expect(source).toContain("dot={entry.monthly ? { r: 4 } : false}");
  });
});

describe("CommodityNativeTooltip", () => {
  it("shows the native price and unit while the series is indexed", () => {
    const html = renderToStaticMarkup(
      <CommodityNativeTooltip
        active
        range="1y"
        label={Date.parse("2026-03-10T00:00:00.000Z")}
        payload={[
          {
            color: "#f97316",
            name: "Brent crude ($/bbl)",
            payload: {
              date: "2026-03-10",
              time: Date.parse("2026-03-10T00:00:00.000Z"),
              value: 110,
              native: 77,
              unit: "$/bbl",
              commodity: "brent_crude",
            },
          },
        ]}
      />
    );

    expect(html).toContain("10 Mar 2026");
    expect(html).toContain("77.00 $/bbl");
    expect(html).toContain("Brent crude ($/bbl)");
    expect(html).not.toContain("110");
  });
});

describe("CommodityChart scale toggle", () => {
  it("defaults to the indexed caption and a 44px keyboard toggle", () => {
    const html = renderToStaticMarkup(
      <CommodityChart data={MIXED_CADENCE} range="1y" selectedSeries={["brent_crude"]} />
    );

    expect(html).toContain("Indexed, start of range = 100");
    expect(html).toContain('aria-label="Price scale"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("h-11");
    expect(html).toContain("min-w-11");
    expect(html).toContain("Indexed");
    expect(html).toContain("Native units");
  });
});
