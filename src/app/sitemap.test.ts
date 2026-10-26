import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GET as getSitemapIndex } from "@/app/sitemap.xml/route";
import { GET as getSitemapChild } from "@/app/sitemap/[id]/route";
import sitemap, {
  catalogueLastModified,
  generateSitemaps,
  lastModifiedForPath,
  latestCommodityTimestamp,
  SITEMAP_BYTE_LIMIT,
  SITEMAP_URL_LIMIT,
} from "@/lib/sitemap-document";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { assetDetailIndexable, projectDetailIndexable } from "@/lib/seo/indexable";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";

describe("sitemap", () => {
  it("includes the new SEO routes and lastmod when cache has a stamp", async () => {
    const urls = [
      ...(await sitemap({ id: "pages" })),
      ...(await sitemap({ id: "assets" })),
      ...(await sitemap({ id: "projects" })),
    ].map((entry) => entry.url);
    const pages = [
      "https://grid.vahaah.com",
      "https://grid.vahaah.com/today",
      "https://grid.vahaah.com/gas",
      "https://grid.vahaah.com/power-cuts",
      "https://grid.vahaah.com/system/constraints",
      "https://grid.vahaah.com/system/storage",
      "https://grid.vahaah.com/system/whole-energy",
      "https://grid.vahaah.com/electricity/northern-ireland",
      "https://grid.vahaah.com/map",
      "https://grid.vahaah.com/assets",
      "https://grid.vahaah.com/projects",
      "https://grid.vahaah.com/pipeline",
      "https://grid.vahaah.com/directory",
      "https://grid.vahaah.com/directory/identifiers",
      "https://grid.vahaah.com/tools",
      "https://grid.vahaah.com/changes",
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
    const assetCount = loadAssetCatalogue().rows.filter(assetDetailIndexable).length;
    const projectCount = loadProjectCatalogue().projects.filter(projectDetailIndexable).length;
    const assetUrls = urls.slice(pages.length, pages.length + assetCount);
    const projectUrls = urls.slice(pages.length + assetCount);
    expect(assetUrls).toHaveLength(assetCount);
    expect(projectUrls).toHaveLength(projectCount);
    expect(assetUrls.every((url) => /^https:\/\/grid\.vahaah\.com\/assets\/ast_[a-f0-9]{16}\/[a-z0-9-]+$/.test(url))).toBe(true);
    expect(projectUrls.every((url) => /^https:\/\/grid\.vahaah\.com\/projects\/epj_[a-f0-9]{16}\/[a-z0-9-]+$/.test(url))).toBe(true);
    expect(SITEMAP_PATHS.length).toBeGreaterThanOrEqual(8);
    expect(urls.length).toBe(SITEMAP_PATHS.length + assetCount + projectCount);
    expect(urls).not.toContain("https://grid.vahaah.com/llms.txt");
    expect(generateSitemaps().map((item) => item.id)).toEqual(["pages", "assets", "projects"]);
    const assets = await sitemap({ id: "assets" });
    expect(assets[0]?.lastModified).toEqual(catalogueLastModified().assets);
    const pageEntries = await sitemap({ id: "pages" });
    expect(pageEntries.every((entry) => entry.lastModified instanceof Date)).toBe(true);
  });

  it("assigns lastmod only to data-driven routes", () => {
    const grid = new Date("2026-10-10T11:00:00.000Z");
    const gas = new Date("2026-10-09T00:00:00.000Z");
    const stamps = { grid, gas };
    expect(lastModifiedForPath("", stamps)).toBe(grid);
    expect(lastModifiedForPath("/today", stamps)).toBe(grid);
    expect(lastModifiedForPath("/llms.txt", stamps)).toBeUndefined();
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
    expect(lastModifiedForPath("/projects", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/directory", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/directory/identifiers", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/tools", stamps)).toBeUndefined();
    expect(lastModifiedForPath("/changes", stamps)).toBeUndefined();
    expect(latestCommodityTimestamp([{ date: "2026-10-08", commodity: "gb_gas_sap", price: 3, currency: "GBP", unit: "p/kWh" }, { date: "2026-10-09", commodity: "henry_hub_gas", price: 2, currency: "USD", unit: "$/MMBTU" }])?.toISOString()).toBe(
      "2026-10-09T00:00:00.000Z"
    );
  });

  it("includes interconnectors and leaves unbuilt routes out", async () => {
    const urls = [
      ...(await sitemap({ id: "pages" })),
      ...(await sitemap({ id: "assets" })),
      ...(await sitemap({ id: "projects" })),
    ].map((entry) => entry.url);
    const interconnectors = JSON.parse(
      readFileSync(resolve(process.cwd(), "data/catalogue/interconnectors.json"), "utf8"),
    ) as Array<{ interconnector_id: string }>;
    const assets = loadAssetCatalogue().rows;
    expect(interconnectors.length).toBeGreaterThan(0);
    for (const row of interconnectors) {
      const asset = assets.find((item) => item.id === row.interconnector_id);
      expect(asset).toBeDefined();
      const listed = urls.some((url) => url.includes(`/assets/${row.interconnector_id}/`));
      expect(listed).toBe(asset ? assetDetailIndexable(asset) : false);
    }
    expect(urls).toContain("https://grid.vahaah.com/system/constraints");
    expect(urls).toContain("https://grid.vahaah.com/system/storage");
    expect(urls).toContain("https://grid.vahaah.com/system/whole-energy");
    expect(urls).toContain("https://grid.vahaah.com/projects");
    expect(urls).toContain("https://grid.vahaah.com/directory");
    expect(urls).toContain("https://grid.vahaah.com/directory/identifiers");
    for (const hidden of ["/system/generation", "/system/demand", "/system/carbon", "/system/transfers"]) {
      expect(urls.some((url) => new URL(url).pathname === hidden || new URL(url).pathname.startsWith(`${hidden}/`))).toBe(false);
    }
  });

  it("serves /sitemap.xml as an index and each child as XML", async () => {
    const index = await getSitemapIndex();
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toContain("application/xml");
    const xml = await index.text();
    expect(xml).toContain("<sitemapindex");
    expect(xml).not.toContain("<urlset");
    const blocks = [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/sitemap>/g)];
    expect(blocks.map((match) => match[1])).toEqual([
      "https://grid.vahaah.com/sitemap/pages.xml",
      "https://grid.vahaah.com/sitemap/assets.xml",
      "https://grid.vahaah.com/sitemap/projects.xml",
    ]);
    for (const match of blocks) {
      expect(Number.isNaN(Date.parse(match[2] ?? ""))).toBe(false);
    }
    for (const loc of blocks.map((match) => match[1] ?? "")) {
      const id = new URL(loc).pathname.split("/").pop() ?? "";
      const child = await getSitemapChild(new Request(loc), { params: Promise.resolve({ id }) });
      expect(child.status).toBe(200);
      expect(child.headers.get("content-type")).toContain("application/xml");
      const body = await child.text();
      expect(body.startsWith("<?xml")).toBe(true);
      expect(body).toContain("<urlset");
      expect(body).not.toContain("<sitemapindex");
      const count = body.match(/<loc>/g)?.length ?? 0;
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(SITEMAP_URL_LIMIT);
      expect(Buffer.byteLength(body, "utf8")).toBeLessThanOrEqual(SITEMAP_BYTE_LIMIT);
    }
    const missing = await getSitemapChild(new Request("https://grid.vahaah.com/sitemap/nope.xml"), {
      params: Promise.resolve({ id: "nope.xml" }),
    });
    expect(missing.status).toBe(404);
  });

  it("peeks Redis only and does not query Tinybird", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../lib/sitemap-document.ts"), "utf8");
    expect(source).toContain("peekWarmedPipe");
    expect(source).toContain("peekLatestPrices");
    expect(source).not.toContain("peekThroughCache");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("loadDashboardPayload");
    expect(source).not.toContain("loadCachedPublicPrices");
  });
});
