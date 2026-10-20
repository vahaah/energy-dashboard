import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateStyleMin, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { basemapStyle, pointZoomstackSource, themeColor } from "@/lib/map/basemap-style";
import { SCHEMATIC_BBOX } from "@/lib/catalogue/links/schema";
import {
  BASEMAP_FONTSTACK,
  BASEMAP_SOURCE_URL,
  MAP_MAX_BOUNDS,
  OVERVIEW_CAMERA_LIMIT,
  ZOOMSTACK_LAND_EXTENT,
  osBasemapAttribution,
} from "@/lib/map/constants";
import { decodeGlyphRange } from "@/lib/map/glyph-pbf";

describe("basemap style", () => {
  it("checks in quiet light and dark styles that use the Geist tokens and the OS credit", () => {
    for (const theme of ["light", "dark"] as const) {
      const path = resolve(process.cwd(), `public/basemap/style-${theme}.json`);
      const checkedIn = JSON.parse(readFileSync(path, "utf8")) as {
        sources: { zoomstack: { url: string; attribution: string } };
      };
      const basemap = (
        JSON.parse(readFileSync(resolve(process.cwd(), "data/catalogue/layers.json"), "utf8")) as {
          id: string;
          url: string | null;
        }[]
      ).find((layer) => layer.id === "basemap");
      const expected = basemapStyle(theme, 2026) as unknown as {
        sources: { zoomstack: { url: string; attribution: string } };
      };
      if (basemap?.url) {
        expected.sources.zoomstack = pointZoomstackSource(expected.sources.zoomstack, basemap.url, 2026);
      }
      expect(checkedIn).toEqual(expected);
      expect(validateStyleMin(checkedIn as unknown as StyleSpecification)).toEqual([]);
      expect(checkedIn.sources.zoomstack.url).toBe(basemap?.url ? `pmtiles://${basemap.url}` : BASEMAP_SOURCE_URL);
      expect(checkedIn.sources.zoomstack.attribution).toBe(osBasemapAttribution(2026));
      expect(JSON.stringify(checkedIn)).not.toMatch(/openstreetmap|osm\.org|tile\.openstreetmap/i);
    }
    expect(themeColor("light", "land")).toBe("#f3f1ec");
    expect(themeColor("light", "sea")).toBe("#c5d7e6");
    expect(themeColor("light", "coast")).toBe("#5e6d78");
    expect(themeColor("dark", "land")).toBe("#2c2e32");
    expect(themeColor("dark", "sea")).toBe("#0d1b27");
    expect(themeColor("dark", "coast")).toBe("#8b98a4");
    for (const token of ["land", "sea", "coast"] as const) {
      for (const theme of ["light", "dark"] as const) {
        expect(["#ffffff", "#fafafa", "#0a0a0a", "#000000"]).not.toContain(themeColor(theme, token));
      }
    }
    expect(themeColor("light", "label")).toBe("#525252");
    expect(themeColor("dark", "label")).toBe("#a1a1a1");
    expect(themeColor("light", "roadLocal")).toBe("#d4d4d4");
    expect(themeColor("dark", "roadLocal")).toBe("#2e2e2e");
    const light = basemapStyle("light", 2026);
    expect(light.glyphs).toBe("/basemap/glyphs/{fontstack}/{range}.pbf");
    expect(JSON.stringify(light)).toContain(BASEMAP_FONTSTACK);
    expect(JSON.stringify(light)).toContain("land-extent");
    expect(JSON.stringify(light)).toContain("sea-margin");
    expect(JSON.stringify(light)).toContain('"Wales","left"');
    const seaMargin = (
      light.sources as {
        "sea-margin": { data: { geometry: { coordinates: number[][][] } } };
      }
    )["sea-margin"];
    const outer = seaMargin.data.geometry.coordinates[0] ?? [];
    const hole = seaMargin.data.geometry.coordinates[1] ?? [];
    const xs = outer.map((point) => point[0] ?? 0);
    const ys = outer.map((point) => point[1] ?? 0);
    expect(Math.min(...xs)).toBeLessThan(MAP_MAX_BOUNDS[0][0]);
    expect(Math.max(...xs)).toBeGreaterThan(MAP_MAX_BOUNDS[1][0]);
    expect(Math.min(...ys)).toBeLessThan(MAP_MAX_BOUNDS[0][1]);
    expect(Math.max(...ys)).toBeGreaterThan(MAP_MAX_BOUNDS[1][1]);
    const holeXs = hole.map((point) => point[0] ?? 0);
    const holeYs = hole.map((point) => point[1] ?? 0);
    expect(Math.min(...holeXs)).toBeGreaterThan(ZOOMSTACK_LAND_EXTENT.west);
    expect(Math.max(...holeXs)).toBeLessThan(ZOOMSTACK_LAND_EXTENT.east);
    expect(Math.min(...holeYs)).toBeGreaterThan(ZOOMSTACK_LAND_EXTENT.south);
    expect(Math.max(...holeYs)).toBeLessThan(ZOOMSTACK_LAND_EXTENT.north);
    expect(JSON.stringify(light)).toContain("/basemap/coastline.geojson");
    expect(JSON.stringify(light)).toContain("/basemap/names.geojson");
    expect(JSON.stringify(light)).toContain("names-overview");
    expect(JSON.stringify(light)).not.toContain("fill-outline-color");
    const names = JSON.parse(readFileSync(resolve(process.cwd(), "public/basemap/names.geojson"), "utf8")) as {
      features: { properties: { name1: string; type: string } }[];
    };
    expect(
      names.features.some((feature) => feature.properties.name1 === "London" && feature.properties.type === "Capital"),
    ).toBe(true);
    expect(
      names.features.some(
        (feature) => feature.properties.name1 === "Scotland" && feature.properties.type === "Country",
      ),
    ).toBe(true);
    expect(MAP_MAX_BOUNDS).toEqual([
      [SCHEMATIC_BBOX.west, SCHEMATIC_BBOX.south],
      [SCHEMATIC_BBOX.east, SCHEMATIC_BBOX.north],
    ]);
    const [[overviewWest, overviewSouth], [overviewEast, overviewNorth]] = OVERVIEW_CAMERA_LIMIT;
    expect(overviewWest).toBeGreaterThan(ZOOMSTACK_LAND_EXTENT.west);
    expect(overviewSouth).toBeGreaterThan(ZOOMSTACK_LAND_EXTENT.south);
    expect(overviewEast).toBeLessThan(ZOOMSTACK_LAND_EXTENT.east);
    expect(overviewNorth).toBeLessThan(ZOOMSTACK_LAND_EXTENT.north);
    expect(overviewEast).toBeLessThan(9.17726);
    expect(overviewSouth).toBeGreaterThan(49.12425);
    const coast = JSON.parse(readFileSync(resolve(process.cwd(), "public/basemap/coastline.geojson"), "utf8")) as {
      features: { geometry: { type: string; coordinates: number[][][] } }[];
    };
    const lines = coast.features[0]?.geometry.coordinates ?? [];
    expect(coast.features[0]?.geometry.type).toBe("MultiLineString");
    expect(lines.length).toBeGreaterThan(100);
    const clipEast = 3.603515625;
    const verticalBox = lines.some((line) => {
      let minLat = 90;
      let maxLat = -90;
      let minLon = 180;
      let maxLon = -180;
      for (const point of line) {
        const lon = point[0] ?? 0;
        const lat = point[1] ?? 0;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
      return maxLat - minLat > 1 && maxLon - minLon < 0.05 && Math.abs(minLon - clipEast) < 0.05;
    });
    expect(verticalBox).toBe(false);
    const runs = new Map<string, number>();
    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        const start = line[index - 1];
        const end = line[index];
        if (!start || !end) {
          continue;
        }
        const lon = start[0] ?? 0;
        const lat = start[1] ?? 0;
        const nextLon = end[0] ?? 0;
        const nextLat = end[1] ?? 0;
        if (lon === nextLon && lat !== nextLat) {
          const key = `v:${lon.toFixed(5)}`;
          runs.set(key, (runs.get(key) ?? 0) + Math.abs(nextLat - lat));
        } else if (lat === nextLat && lon !== nextLon) {
          const key = `h:${lat.toFixed(5)}`;
          runs.set(key, (runs.get(key) ?? 0) + Math.abs(nextLon - lon));
        }
      }
    }
    const longest = Math.max(0, ...runs.values());
    expect(longest).toBeLessThanOrEqual(0.4);
  });

  it("checks in a Geist glyph stack and empty sprites", () => {
    const glyphs = decodeGlyphRange(
      readFileSync(resolve(process.cwd(), `public/basemap/glyphs/${BASEMAP_FONTSTACK}/0-255.pbf`)),
    );
    expect(glyphs.name).toBe(BASEMAP_FONTSTACK);
    expect(glyphs.range).toBe("0-255");
    const letter = glyphs.glyphs.find((glyph) => glyph.id === 65);
    expect(letter).toBeDefined();
    if (!letter) {
      return;
    }
    expect(letter.advance).toBeGreaterThan(0);
    expect(letter.bitmap.length).toBe((letter.width + 6) * (letter.height + 6));
    const sprite = readFileSync(resolve(process.cwd(), "public/basemap/sprites/light.json"), "utf8");
    expect(sprite.trim()).toBe("{}");
    expect(readFileSync(resolve(process.cwd(), "public/basemap/sprites/dark.png"))[0]).toBe(137);
    const script = readFileSync(resolve(process.cwd(), "scripts/basemap/glyphs.ts"), "utf8");
    expect(script).toContain("left: glyphLeft,");
    expect(script).toContain("top: glyphTop,");
    expect(script).not.toContain("glyphLeft - BUFFER");
    expect(script).not.toContain("glyphTop + BUFFER");
  });

  it("stamps the edition year onto the style source when the PMTiles URL changes", () => {
    const source = {
      type: "vector" as const,
      url: BASEMAP_SOURCE_URL,
      attribution: osBasemapAttribution(2026),
      minzoom: 0,
      maxzoom: 13,
    };
    expect(pointZoomstackSource(source, "https://blob.example/tiles/basemap/2027-03.pmtiles", 2027)).toEqual({
      ...source,
      url: "pmtiles://https://blob.example/tiles/basemap/2027-03.pmtiles",
      attribution: osBasemapAttribution(2027),
    });
    const script = readFileSync(resolve(process.cwd(), "scripts/build-basemap.ts"), "utf8");
    expect(script).toContain("pointStylesAt(blob.url, year)");
    expect(script).toContain("source.attribution = pointed.attribution");
  });
});
