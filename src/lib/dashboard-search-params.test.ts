import { describe, expect, it } from "vitest";
import {
  clampDashboardDate,
  dateParamForRange,
  DASHBOARD_FOCUSES,
  DASHBOARD_RANGES,
  resolveDashboardDate,
} from "@/lib/dashboard-search-params";
import {
  loadDashboardSearchParams,
  serializeDashboardSearchParams,
} from "@/lib/dashboard-search-params.server";

describe("dashboard search params", () => {
  it("applies defaults when params are missing", async () => {
    await expect(loadDashboardSearchParams(Promise.resolve({}))).resolves.toEqual({
      range: "24h",
      period: null,
      commodityRange: "90d",
      focus: "overview",
      price: "mid",
      date: null,
      generationPeriod: null,
      pricePeriod: null,
      transfersPeriod: null,
      mixPeriod: null,
      carbonPeriod: null,
    });
  });

  it("parses valid params and ignores invalid values", async () => {
    await expect(
      loadDashboardSearchParams(
        Promise.resolve({
          range: "7d",
          commodityRange: "1y",
          focus: "commodities",
          price: "system",
          date: "2026-03-10",
        })
      )
    ).resolves.toEqual({
      range: "7d",
      period: null,
      commodityRange: "1y",
      focus: "commodities",
      price: "system",
      date: "2026-03-10",
      generationPeriod: null,
      pricePeriod: null,
      transfersPeriod: null,
      mixPeriod: null,
      carbonPeriod: null,
    });

    await expect(
      loadDashboardSearchParams(
        Promise.resolve({
          range: "bogus",
          commodityRange: "bogus",
          focus: "bogus",
          date: "not-a-date",
        })
      )
    ).resolves.toEqual({
      range: "24h",
      period: null,
      commodityRange: "90d",
      focus: "overview",
      price: "mid",
      date: null,
      generationPeriod: null,
      pricePeriod: null,
      transfersPeriod: null,
      mixPeriod: null,
      carbonPeriod: null,
    });
  });

  it("parses per-block period overrides without dropping focus", async () => {
    await expect(
      loadDashboardSearchParams(
        Promise.resolve({
          period: "day",
          pricePeriod: "week",
          carbonPeriod: "year",
          focus: "price",
        })
      )
    ).resolves.toMatchObject({
      period: "day",
      pricePeriod: "week",
      carbonPeriod: "year",
      focus: "price",
    });
  });

  it("parses period=year for share links", async () => {
    await expect(
      loadDashboardSearchParams(Promise.resolve({ period: "year" }))
    ).resolves.toMatchObject({ period: "year", range: "24h" });
    await expect(
      loadDashboardSearchParams(Promise.resolve({ period: "all" }))
    ).resolves.toMatchObject({ period: "all" });
  });

  it("keeps share-URL focus ids and puts generation before carbon", () => {
    expect(DASHBOARD_FOCUSES).toEqual([
      "overview",
      "generation",
      "price",
      "transfers",
      "commodities",
      "records",
      "carbon",
    ]);
  });

  it("serializes non-default deep-link state", () => {
    expect(
      serializeDashboardSearchParams({
        range: "30d",
        period: "year",
        commodityRange: "1y",
        focus: "transfers",
        price: "system",
        date: "2026-03-10",
      })
    ).toBe("?range=30d&period=year&commodityRange=1y&focus=transfers&price=system&date=2026-03-10");
  });
});

describe("dashboard date coverage", () => {
  const now = new Date("2026-09-27T16:00:00.000Z");

  it("clamps dates to the 12-month coverage window", () => {
    expect(clampDashboardDate("2015-01-01", now)).toBe("2025-09-27");
    expect(clampDashboardDate("2030-01-01", now)).toBe("2026-09-27");
    expect(clampDashboardDate("2026-09-20", now)).toBe("2026-09-20");
  });

  it("marks dates outside coverage as empty instead of using live data", () => {
    expect(resolveDashboardDate("2015-01-01", now).status).toBe("empty");
    expect(resolveDashboardDate("2030-01-01", now).status).toBe("empty");
    expect(resolveDashboardDate("2026-09-20", now)).toMatchObject({
      status: "historical",
      date: "2026-09-20",
    });
    expect(resolveDashboardDate(null, now).status).toBe("latest");
  });

  it("ignores the date parameter outside the 24h view", () => {
    expect(dateParamForRange("24h", "2026-09-20")).toBe("2026-09-20");
    expect(dateParamForRange("24h", "not-a-date")).toBeNull();
    expect(dateParamForRange("24h", null)).toBeNull();

    for (const range of DASHBOARD_RANGES) {
      if (range === "24h") {
        continue;
      }
      expect(dateParamForRange(range, "2026-09-20")).toBeNull();
      expect(dateParamForRange(range, "2015-01-01")).toBeNull();
      expect(resolveDashboardDate("2026-09-20", now, range).status).toBe("latest");
      expect(resolveDashboardDate("2015-01-01", now, range).status).toBe("latest");
    }

    expect(resolveDashboardDate("2026-09-20", now, "24h")).toMatchObject({
      status: "historical",
      date: "2026-09-20",
    });
    expect(resolveDashboardDate("2015-01-01", now, "24h").status).toBe("empty");
  });
});
