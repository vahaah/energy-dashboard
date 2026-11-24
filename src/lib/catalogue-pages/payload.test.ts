import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_LIST_DEFAULT, assetCounts, queryAssetPage, toAssetListRow } from "@/lib/assets/list";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { readFixtureRelease } from "@/lib/balancing/load";
import { balancingRangeSeries, buildBalancingPage } from "@/lib/balancing/page-model";
import { PIPELINE_LIST_DEFAULT, selectPipelineRows } from "@/lib/pipeline/list";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";
import { loadProjectsPageData } from "@/lib/projects/page-data";

const HTML_BUDGET = 300_000;

describe("catalogue page payloads", () => {
  it("ships one page of projects, with counts, and leaves the register off the first response", () => {
    const data = loadProjectsPageData();
    expect(data.list.rows.length).toBeLessThanOrEqual(40);
    expect(data.list.total).toBeGreaterThan(data.list.rows.length);
    expect(data.counts.stage.length).toBeGreaterThan(0);
    expect(data.counts.technology.length).toBeGreaterThan(0);
    expect(data.counts.nation.length).toBeGreaterThan(0);
    expect(data.counts.stage.reduce((sum, row) => sum + row.count, 0)).toBe(data.list.total);
    const bytes = Buffer.byteLength(JSON.stringify({ ...data, document: data.document }));
    expect(bytes).toBeLessThan(HTML_BUDGET);
    const page = readFileSync(resolve(process.cwd(), "src/app/projects/page.tsx"), "utf8");
    expect(page).toContain("loadProjectsPageData");
    expect(page).not.toContain("queryPipe");
    expect(page).toContain('export const dynamic = "force-static"');
  });

  it("ships one page of assets and the technology, nation and stage counts", () => {
    const catalogue = loadAssetCatalogue();
    const counts = assetCounts(catalogue.rows);
    const list = queryAssetPage(catalogue.rows, ASSET_LIST_DEFAULT, null);
    expect(list.rows.length).toBeLessThanOrEqual(25);
    expect(list.total).toBe(catalogue.rows.length);
    expect(counts.technology.length).toBeGreaterThan(0);
    expect(counts.nation.length).toBeGreaterThan(0);
    expect(counts.stage.reduce((sum, row) => sum + row.count, 0)).toBe(catalogue.rows.length);
    const bytes = Buffer.byteLength(
      JSON.stringify({
        counts,
        rows: list.rows.map(toAssetListRow),
        regions: catalogue.regions,
      }),
    );
    expect(bytes).toBeLessThan(HTML_BUDGET);
    const page = readFileSync(resolve(process.cwd(), "src/app/assets/page.tsx"), "utf8");
    expect(page).toContain("queryAssetPage");
    expect(page).not.toContain("rows={catalogue.rows}");
    expect(page).toContain('export const dynamic = "force-static"');
  });

  it("ships pipeline figures without the project table", () => {
    const catalogue = loadPipelineCatalogue();
    const list = selectPipelineRows(catalogue.figures.table, PIPELINE_LIST_DEFAULT);
    const figures = { ...catalogue.figures, table: [] as const };
    expect(list.rows.length).toBeLessThanOrEqual(40);
    expect(list.total).toBeGreaterThan(list.rows.length);
    expect(figures.table).toEqual([]);
    expect(figures.stages.length).toBeGreaterThan(0);
    expect(figures.nations.length).toBeGreaterThan(0);
    expect(figures.technologies.length).toBeGreaterThan(0);
    const bytes = Buffer.byteLength(JSON.stringify({ figures, rows: list.rows }));
    expect(bytes).toBeLessThan(HTML_BUDGET);
    const page = readFileSync(resolve(process.cwd(), "src/app/pipeline/page.tsx"), "utf8");
    const copy = readFileSync(resolve(process.cwd(), "src/lib/pipeline/copy.ts"), "utf8");
    expect(page).toContain("table: []");
    expect(copy).toContain("Renewable Energy Planning Database");
    expect(copy.toLowerCase()).not.toContain("capacity map");
    expect(page).not.toContain("queryPipe");
  });

  it("ships the balancing default ranges and not the full daily history", () => {
    const release = readFixtureRelease();
    expect(release).not.toBeNull();
    const model = buildBalancingPage(release, new Date("2026-11-24T12:00:00.000Z"));
    const daily = balancingRangeSeries(model, "90d");
    const monthly = balancingRangeSeries(model, "1y");
    expect(daily.daily.length).toBeLessThanOrEqual(90);
    expect(monthly.monthly.length).toBeLessThanOrEqual(13);
    expect(model.days.length).toBeGreaterThan(daily.daily.length);
    const bytes = Buffer.byteLength(
      JSON.stringify({ daily: daily.daily, monthly: monthly.monthly, trade: daily.trade }),
    );
    expect(bytes).toBeLessThan(120_000);
    const page = readFileSync(resolve(process.cwd(), "src/app/system/balancing/page.tsx"), "utf8");
    expect(page).toContain('balancingRangeSeries(model, "90d")');
    expect(page).not.toContain("<BalancingBoard model=");
    expect(page).not.toContain("queryPipe");
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(home).not.toContain("maplibre");
  });
});
