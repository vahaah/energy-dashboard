import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { containsLiveWord } from "@/lib/assets/labels";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("map and asset pages", () => {
  it("keeps the homepage static and the map library off the homepage graph entry", () => {
    const home = source("src/app/page.tsx");
    const map = source("src/app/map/page.tsx");
    const assets = source("src/app/assets/page.tsx");
    const detail = source("src/app/assets/[id]/page.tsx");
    const power = source("src/components/power-map.tsx");
    const header = source("src/components/site-top-bar.tsx");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(map).toContain('export const dynamic = "force-static"');
    expect(assets).toContain('export const dynamic = "force-static"');
    expect(detail).toContain('export const dynamic = "force-static"');
    expect(map).toContain("MAP_COVERAGE_COPY");
    expect(power).toContain('import("@/lib/map/browser")');
    expect(power).not.toContain('from "maplibre-gl"');
    expect(header).not.toContain("maplibre-gl");
    expect(header).not.toContain("pmtiles");
    for (const file of [map, assets, detail, power, source("src/components/map-explorer.tsx"), source("src/components/asset-search.tsx"), source("src/components/asset-directory.tsx")]) {
      expect(containsLiveWord(file)).toBe(false);
    }
  });
});
