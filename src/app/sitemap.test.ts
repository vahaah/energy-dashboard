import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap, { lastModifiedForPath, latestCommodityTimestamp } from "@/app/sitemap";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";

describe("sitemap", () => {
  it("includes the new SEO routes and lastmod when cache has a stamp", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toEqual([
      "https://grid.vahaah.com",
      "https://grid.vahaah.com/today",
      "https://grid.vahaah.com/llms.txt",
      "https://grid.vahaah.com/records",
      "https://grid.vahaah.com/explained/price-cap",
      "https://grid.vahaah.com/prices/gas",
      "https://grid.vahaah.com/methodology",
      "https://grid.vahaah.com/api",
      "https://grid.vahaah.com/privacy",
      "https://grid.vahaah.com/terms",
      "https://grid.vahaah.com/data-sources",
    ]);
    expect(SITEMAP_PATHS.length).toBeGreaterThanOrEqual(8);
    expect(urls.length).toBe(SITEMAP_PATHS.length);
  });

  it("assigns lastmod only to data-driven routes", () => {
    const grid = new Date("2026-10-10T11:00:00.000Z");
    const gas = new Date("2026-10-09T00:00:00.000Z");
    const stamps = { grid, gas };
    expect(lastModifiedForPath("", stamps)).toBe(grid);
    expect(lastModifiedForPath("/today", stamps)).toBe(grid);
    expect(lastModifiedForPath("/llms.txt", stamps)).toBe(grid);
    expect(lastModifiedForPath("/prices/gas", stamps)).toBe(gas);
    expect(lastModifiedForPath("/privacy", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/terms", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/methodology", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/api", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/explained/price-cap", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/records", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/data-sources", stamps)).toBeUndefined();
    expect(latestCommodityTimestamp([{ date: "2026-10-08", commodity: "gb_gas_sap", price: 3, currency: "GBP", unit: "p/kWh" }, { date: "2026-10-09", commodity: "henry_hub_gas", price: 2, currency: "USD", unit: "$/MMBTU" }])?.toISOString()).toBe(
      "2026-10-09T00:00:00.000Z"
    );
  });

  it("peeks Redis only and does not query Tinybird", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./sitemap.ts"), "utf8");
    expect(source).toContain("peekThroughCache");
    expect(source).toContain("peekLatestPrices");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("loadDashboardPayload");
    expect(source).not.toContain("loadCachedPublicPrices");
  });
});
