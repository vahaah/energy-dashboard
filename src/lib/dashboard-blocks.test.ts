import { describe, expect, it } from "vitest";
import {
  adjacentPeriods,
  blockPeriodParam,
  dashboardQueryKey,
  effectiveBlockPeriod,
} from "@/lib/dashboard-blocks";

describe("dashboard blocks", () => {
  it("maps each block to a URL param and inherits the global period", () => {
    expect(blockPeriodParam("generation")).toBe("generationPeriod");
    expect(blockPeriodParam("price")).toBe("pricePeriod");
    expect(blockPeriodParam("transfers")).toBe("transfersPeriod");
    expect(blockPeriodParam("mix")).toBe("mixPeriod");
    expect(blockPeriodParam("carbon")).toBe("carbonPeriod");
    expect(effectiveBlockPeriod("day", null)).toBe("day");
    expect(effectiveBlockPeriod("day", "week")).toBe("week");
  });

  it("prefetches neighbouring periods only", () => {
    expect(adjacentPeriods("day")).toEqual(["week"]);
    expect(adjacentPeriods("week")).toEqual(["day", "year"]);
    expect(adjacentPeriods("year")).toEqual(["week", "all"]);
    expect(adjacentPeriods("all")).toEqual(["year"]);
    expect(dashboardQueryKey("week", null)).toBe("dashboard:week:");
    expect(dashboardQueryKey("day", "2026-05-19")).toBe("dashboard:day:2026-05-19");
  });
});
