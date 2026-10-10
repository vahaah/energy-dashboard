import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("DemandBalanceChart layout", () => {
  it("keeps end labels inside a full-width plot", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./demand-balance-chart.tsx"), "utf8");

    expect(source).toContain("demandChartMargin");
    expect(source).toContain("demandSeriesLabelLayout");
    expect(source).toContain("forecastLabelLayout");
    expect(source).toContain("formatDemandBalanceTickLines");
    expect(source).toContain("width === 0 || width < COMPACT_CHART_WIDTH");
    expect(source).not.toContain("right: compact ? 12 : 108");
    expect(source).not.toContain("const showEndLabels = !compact");
  });
});
