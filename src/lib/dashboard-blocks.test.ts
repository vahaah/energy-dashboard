import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  blockPeriodParam,
  dashboardQueryKey,
  effectiveBlockPeriod,
  PERIOD_OPTIONS,
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

  it("does not auto-prefetch Year when Week is selected", () => {
    const dashboard = readFileSync(
      resolve(import.meta.dirname, "../components/dashboard.tsx"),
      "utf8"
    );
    expect(dashboard).not.toContain("adjacentPeriods");
    expect(dashboardQueryKey("week", null)).toBe("dashboard:week:");
    expect(dashboardQueryKey("day", "2026-05-19")).toBe("dashboard:day:2026-05-19");
  });

  it("keeps one page-level Day/Week/Year/All control", () => {
    expect(PERIOD_OPTIONS.map((option) => option.value)).toEqual(["day", "week", "year", "all"]);
    const header = readFileSync(resolve(import.meta.dirname, "../components/period-tabs.tsx"), "utf8");
    const blocks = readFileSync(resolve(import.meta.dirname, "../components/dashboard.tsx"), "utf8");
    expect(header).toContain("PERIOD_OPTIONS");
    expect(blocks).toContain("<PeriodTabs");
    expect(blocks).not.toContain("BlockPeriodControl");
    expect(blocks).not.toContain('ariaLabel="Chart range"');
    expect(header).not.toContain('label: "All time"');
  });
});
