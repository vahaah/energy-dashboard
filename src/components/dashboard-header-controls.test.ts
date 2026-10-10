import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard header controls", () => {
  it("keeps a 44px mobile tap target and a 32px desktop control", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./site-header.tsx"), "utf8");

    expect(source).toContain("h-8");
    expect(source).toContain("min-h-11");
    expect(source).toContain("sm:min-h-8");
    expect(source).not.toContain("Refresh");
  });

  it("refetches on tab focus instead of a Refresh button", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./dashboard.tsx"), "utf8");

    expect(source).toContain("visibilitychange");
    expect(source).toContain("revalidateAllQueries()");
    expect(source).toContain('history: "replace"');
    expect(source).toContain("shallow: true");
    expect(source).not.toContain("router.refresh()");
    expect(source).not.toContain("Refresh");
    expect(source).toContain("minDate={getDashboardCoverageStart(now)}");
    expect(source).toContain("price.error && !priceData");
    expect(source).toContain("transfers.error && !transfersData");
    expect(source).toContain("mix.error && !mixData");
    expect(source).toContain("carbon.error && !carbonData");
    expect(source).toContain("fetchDashboardPayload(period, date)");
    expect(source).not.toContain("dashboardQueryKey(period, date, commodityRange)");
  });
});

describe("info tooltip hit area", () => {
  it("keeps a 44px tap target and opens on tap or focus", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "./ui/info-tooltip.tsx"),
      "utf8"
    );

    expect(source).toContain("size-11");
    expect(source).toContain("onFocus");
    expect(source).toContain("onClick");
    expect(source).not.toContain("size-6");
  });
});
