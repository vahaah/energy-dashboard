import { describe, expect, it } from "vitest";
import {
  loadDashboardSearchParams,
  serializeDashboardSearchParams,
} from "@/lib/dashboard-search-params.server";

describe("dashboard search params", () => {
  it("applies defaults when params are missing", async () => {
    await expect(loadDashboardSearchParams(Promise.resolve({}))).resolves.toEqual({
      range: "24h",
      commodityRange: "90d",
      focus: "overview",
      date: null,
    });
  });

  it("parses valid params and ignores invalid values", async () => {
    await expect(
      loadDashboardSearchParams(
        Promise.resolve({
          range: "7d",
          commodityRange: "1y",
          focus: "commodities",
          date: "2026-03-10",
        })
      )
    ).resolves.toEqual({
      range: "7d",
      commodityRange: "1y",
      focus: "commodities",
      date: "2026-03-10",
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
      commodityRange: "90d",
      focus: "overview",
      date: null,
    });
  });

  it("serializes non-default deep-link state", () => {
    expect(
      serializeDashboardSearchParams({
        range: "30d",
        commodityRange: "1y",
        focus: "transfers",
        date: "2026-03-10",
      })
    ).toBe("?range=30d&commodityRange=1y&focus=transfers&date=2026-03-10");
  });
});
