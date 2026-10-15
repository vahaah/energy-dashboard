import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap, { lastModifiedForPath, latestCommodityTimestamp } from "@/app/sitemap";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";

describe("sitemap", () => {
  it("includes the new SEO routes and lastmod when cache has a stamp", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    const pages = [
      "https://grid.vahaah.com",
      "https://grid.vahaah.com/today",
      "https://grid.vahaah.com/gas",
      "https://grid.vahaah.com/system/constraints",
      "https://grid.vahaah.com/system/storage",
      "https://grid.vahaah.com/system/whole-energy",
      "https://grid.vahaah.com/map",
      "https://grid.vahaah.com/assets",
      "https://grid.vahaah.com/directory",
      "https://grid.vahaah.com/directory/identifiers",
      "https://grid.vahaah.com/llms.txt",
      "https://grid.vahaah.com/records",
      "https://grid.vahaah.com/explained/price-cap",
      "https://grid.vahaah.com/prices/gas",
      "https://grid.vahaah.com/methodology",
      "https://grid.vahaah.com/data-health",
      "https://grid.vahaah.com/api",
      "https://grid.vahaah.com/privacy",
      "https://grid.vahaah.com/terms",
      "https://grid.vahaah.com/data-sources",
    ];
    expect(urls.slice(0, pages.length)).toEqual(pages);
    const assetUrls = urls.slice(pages.length);
    expect(assetUrls).toHaveLength(loadAssetCatalogue().rows.length);
    expect(assetUrls.every((url) => /^https:\/\/grid\.vahaah\.com\/assets\/ast_[a-f0-9]{16}\/[a-z0-9-]+$/.test(url))).toBe(true);
    expect(SITEMAP_PATHS.length).toBeGreaterThanOrEqual(8);
    expect(urls.length).toBe(SITEMAP_PATHS.length + assetUrls.length);
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
    expect(lastModifiedForPath("/data-health", stamps)).toBe(grid);
    expect(lastModifiedForPath("/methodology", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/api", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/explained/price-cap", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/records", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/data-sources", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/map", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/gas", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/system/constraints", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/system/storage", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/system/whole-energy", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/assets", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/directory", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/directory/identifiers", stamps)).toBeUndefined();
    expect(latestCommodityTimestamp([{ date: "2026-10-08", commodity: "gb_gas_sap", price: 3, currency: "GBP", unit: "p/kWh" }, { date: "2026-10-09", commodity: "henry_hub_gas", price: 2, currency: "USD", unit: "$/MMBTU" }])?.toISOString()).toBe(
      "2026-10-09T00:00:00.000Z"
    );
  });

  it("includes interconnectors and leaves unbuilt routes out", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    const interconnectors = JSON.parse(
      readFileSync(resolve(process.cwd(), "data/catalogue/interconnectors.json"), "utf8"),
    ) as Array<{ interconnector_id: string }>;
    expect(interconnectors.length).toBeGreaterThan(0);
    for (const row of interconnectors) {
      expect(urls.some((url) => url.includes(`/assets/${row.interconnector_id}/`))).toBe(true);
    }
    expect(urls).toContain("https://grid.vahaah.com/system/constraints");
    expect(urls).toContain("https://grid.vahaah.com/system/storage");
    expect(urls).toContain("https://grid.vahaah.com/system/whole-energy");
    expect(urls).toContain("https://grid.vahaah.com/directory");
    expect(urls).toContain("https://grid.vahaah.com/directory/identifiers");
    for (const hidden of ["/system/generation", "/system/demand", "/system/carbon", "/system/transfers"]) {
      expect(urls.some((url) => new URL(url).pathname === hidden || new URL(url).pathname.startsWith(`${hidden}/`))).toBe(false);
    }
  });

  it("peeks Redis only and does not query Tinybird", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./sitemap.ts"), "utf8");
    expect(source).toContain("peekWarmedPipe");
    expect(source).toContain("peekLatestPrices");
    expect(source).not.toContain("peekThroughCache");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("loadDashboardPayload");
    expect(source).not.toContain("loadCachedPublicPrices");
  });
});
