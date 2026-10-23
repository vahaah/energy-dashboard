import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WARMED_FLOW_REVALIDATE_SECONDS } from "@/lib/assets/cached-flows";
import { getTinybirdCachePolicy } from "@/lib/tinybird-cache";
import { ASSETS_DESCRIPTION } from "@/lib/site";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("map source and asset page review fixes", () => {
  it("keeps clustering on so a wider filter can still cluster", () => {
    const browser = source("src/lib/map/browser.ts");
    expect(browser).toContain("cluster: true");
    expect(browser).not.toContain("cluster: points.length > 1");
  });

  it("does not rebind interconnector line handlers on each style reload", () => {
    const browser = source("src/lib/map/browser.ts");
    const paint = browser.slice(browser.indexOf("function paint(): void"), browser.indexOf('map.on("style.load", paint)'));
    expect(paint).not.toContain("lineClicksBound");
    expect(browser).toContain('if (lineClicksBound || !map.getLayer("interconnector-lines"))');
  });

  it("revalidates canonical asset pages on the warmed flow cadence", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(WARMED_FLOW_REVALIDATE_SECONDS).toBe(1_800);
    expect(getTinybirdCachePolicy({ pipeName: "interconnector_flows", range: "24h", now }).revalidateSeconds).toBe(
      WARMED_FLOW_REVALIDATE_SECONDS,
    );
    const page = source("src/app/assets/[id]/[slug]/page.tsx");
    expect(page).toContain("export const revalidate = 1_800");
    expect(page).toContain("citation={citation}");
    expect(source("src/components/asset-page-view.tsx")).toContain("<CiteButton text={citation} />");
  });

  it("describes interconnectors and National Gas terminals in the directory", () => {
    expect(ASSETS_DESCRIPTION).toContain("interconnectors");
    expect(ASSETS_DESCRIPTION).toContain("gas terminals");
    expect(ASSETS_DESCRIPTION).toContain("DESNZ REPD");
    const page = source("src/app/assets/page.tsx");
    expect(page).toContain("interconnectors from Elexon BMRS");
    expect(page).toContain("National Gas terminal names");
  });
});