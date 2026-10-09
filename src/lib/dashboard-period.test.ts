import { describe, expect, it } from "vitest";
import {
  chartRangeForPeriod,
  isNesoPeriod,
  searchStateForPeriod,
  selectedPeriod,
} from "@/lib/dashboard-period";

describe("dashboard period", () => {
  it("prefers the period query param over range", () => {
    expect(selectedPeriod("year", "24h")).toBe("year");
    expect(selectedPeriod("all", "7d")).toBe("all");
    expect(selectedPeriod(null, "7d")).toBe("week");
    expect(selectedPeriod(null, "1y")).toBe("year");
    expect(selectedPeriod(null, "30d")).toBeNull();
  });

  it("sends Year and All time off Tinybird", () => {
    expect(isNesoPeriod("year")).toBe(true);
    expect(isNesoPeriod("all")).toBe(true);
    expect(isNesoPeriod("day")).toBe(false);
    expect(chartRangeForPeriod("year", "24h")).toBe("1y");
    expect(chartRangeForPeriod("all", "24h")).toBe("all");
    expect(searchStateForPeriod("year")).toEqual({ period: "year", range: "1y", date: null });
    expect(searchStateForPeriod("all")).toEqual({ period: "all", range: "1y", date: null });
  });
});
