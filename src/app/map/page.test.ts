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
    const slug = source("src/app/assets/[id]/[slug]/page.tsx");
    const power = source("src/components/power-map.tsx");
    const header = source("src/components/site-top-bar.tsx");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(map).toContain('export const dynamic = "force-static"');
    expect(assets).toContain('export const dynamic = "force-static"');
    expect(detail).toContain('export const dynamic = "force-static"');
    expect(detail).toContain("permanentRedirect");
    expect(slug).toContain('export const dynamic = "force-static"');
    expect(slug).toContain("permanentRedirect");
    expect(slug).not.toContain("maplibre-gl");
    expect(slug).not.toContain("power-map");
    expect(map).toContain("loadFlowsPageModel");
    expect(map).not.toContain("loadAssetCatalogue");
    expect(map).not.toContain("queryPipe");
    expect(map).not.toContain("maplibre-gl");
    expect(map).not.toContain("maplibre.css");
    expect(source("src/app/map/maplibre.css")).toContain('@import "maplibre-gl/dist/maplibre-gl.css" layer(base)');
    const flows = source("src/components/flows-map.tsx");
    expect(flows).toContain('import("@/app/map/maplibre.css")');
    expect(flows).toContain('import("@/lib/map/flows-browser")');
    expect(flows).not.toContain('import "@/app/map/maplibre.css"');
    expect(flows).not.toContain('from "maplibre-gl"');
    expect(flows).toContain('className="h-full w-full"');
    expect(flows).toContain("absolute inset-0");
    expect(flows).not.toContain("queryPipe");
    expect(flows).not.toContain("/api/interconnectors");
    expect(source("src/lib/map/flows-release.ts")).toContain("peekWarmedPipe");
    expect(source("src/lib/map/flows-release.ts")).not.toContain("queryPipe");
    const search = source("src/components/asset-search.tsx");
    const dialog = source("src/components/asset-search-dialog.tsx");
    expect(power).toContain('import("@/app/map/maplibre.css")');
    expect(power).toContain('import("@/lib/map/browser")');
    expect(power).not.toContain('import "@/app/map/maplibre.css"');
    expect(power).not.toContain('from "maplibre-gl"');
    expect(power).toContain('className="h-full w-full"');
    expect(source("src/lib/map/browser.ts")).not.toContain("maplibre-gl.css");
    expect(source("src/lib/map/flows-browser.ts")).not.toContain("maplibre-gl.css");
    expect(source("src/lib/map/flows-browser.ts")).toContain("zoom: BASEMAP_DETAIL_MIN_ZOOM");
    expect(source("src/lib/map/flows-browser.ts")).toContain("minZoom: MAP_CAMERA_MIN_ZOOM");
    expect(source("src/lib/map/flows-browser.ts")).toContain("maxBounds: MAP_MAX_BOUNDS");
    expect(source("src/lib/map/flows-browser.ts")).toContain("GB_FRAME_BOUNDS");
    expect(source("src/lib/map/flows-browser.ts")).not.toContain("extendSea");
    expect(source("src/lib/map/flows-browser.ts")).not.toContain("minZoom: BASEMAP_DETAIL_MIN_ZOOM");
    expect(source("src/lib/map/browser.ts")).toContain("minZoom: MAP_CAMERA_MIN_ZOOM");
    expect(source("src/lib/map/browser.ts")).toContain("basemapStartupFailed");
    expect(source("src/lib/map/flows-browser.ts")).toContain("basemapStartupFailed");
    expect(header).not.toContain("maplibre-gl");
    expect(header).not.toContain("pmtiles");
    expect(search).toContain('import("@/components/asset-search-dialog")');
    expect(search).not.toContain('from "@/components/asset-search-dialog"');
    expect(search).not.toContain('from "@/lib/assets/index-file"');
    expect(search).not.toContain('from "@/lib/assets/search-index"');
    expect(dialog).toContain("onClick={() => onClose()}");
    for (const file of [
      map,
      assets,
      detail,
      power,
      flows.replaceAll("aria-live", "aria-region"),
      source("src/components/map-explorer.tsx"),
      search,
      dialog,
      source("src/components/asset-directory.tsx"),
      slug,
      source("src/components/asset-page-view.tsx"),
      source("src/components/copy-link-button.tsx"),
    ]) {
      expect(containsLiveWord(file)).toBe(false);
    }
  });
});
