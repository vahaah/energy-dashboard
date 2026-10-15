import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateStyleMin, type StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { basemapStyle, pointZoomstackSource, themeColor } from "@/lib/map/basemap-style";
import { BASEMAP_FONTSTACK, BASEMAP_SOURCE_URL, osBasemapAttribution } from "@/lib/map/constants";
import { decodeGlyphRange } from "@/lib/map/glyph-pbf";

describe("basemap style", () => {
  it("checks in quiet light and dark styles that use the Geist tokens and the OS credit", () => {
    for (const theme of ["light", "dark"] as const) {
      const path = resolve(process.cwd(), `public/basemap/style-${theme}.json`);
      const checkedIn = JSON.parse(readFileSync(path, "utf8")) as { sources: { zoomstack: { url: string; attribution: string } } };
      const basemap = (JSON.parse(readFileSync(resolve(process.cwd(), "data/catalogue/layers.json"), "utf8")) as {
        id: string;
        url: string | null;
      }[]).find((layer) => layer.id === "basemap");
      const expected = basemapStyle(theme, 2026) as unknown as { sources: { zoomstack: { url: string; attribution: string } } };
      if (basemap?.url) {
        expected.sources.zoomstack = pointZoomstackSource(expected.sources.zoomstack, basemap.url, 2026);
      }
      expect(checkedIn).toEqual(expected);
      expect(validateStyleMin(checkedIn as unknown as StyleSpecification)).toEqual([]);
      expect(checkedIn.sources.zoomstack.url).toBe(basemap?.url ? `pmtiles://${basemap.url}` : BASEMAP_SOURCE_URL);
      expect(checkedIn.sources.zoomstack.attribution).toBe(osBasemapAttribution(2026));
      expect(JSON.stringify(checkedIn)).not.toMatch(/openstreetmap|osm\.org|tile\.openstreetmap/i);
    }
    expect(themeColor("light", "background")).toBe("#fafafa");
    expect(themeColor("light", "label")).toBe("#525252");
    expect(themeColor("dark", "background")).toBe("#0a0a0a");
    expect(themeColor("dark", "label")).toBe("#a1a1a1");
    expect(themeColor("light", "roadLocal")).toBe("#d4d4d4");
    expect(themeColor("dark", "roadLocal")).toBe("#2e2e2e");
    const light = basemapStyle("light", 2026);
    expect(light.glyphs).toBe("/basemap/glyphs/{fontstack}/{range}.pbf");
    expect(JSON.stringify(light)).toContain(BASEMAP_FONTSTACK);
  });

  it("checks in a Geist glyph stack and empty sprites", () => {
    const glyphs = decodeGlyphRange(
      readFileSync(resolve(process.cwd(), `public/basemap/glyphs/${BASEMAP_FONTSTACK}/0-255.pbf`)),
    );
    expect(glyphs.name).toBe(BASEMAP_FONTSTACK);
    expect(glyphs.range).toBe("0-255");
    const letter = glyphs.glyphs.find((glyph) => glyph.id === 65);
    expect(letter?.advance).toBeGreaterThan(0);
    expect(letter?.bitmap.length).toBeGreaterThan(0);
    const sprite = readFileSync(resolve(process.cwd(), "public/basemap/sprites/light.json"), "utf8");
    expect(sprite.trim()).toBe("{}");
    expect(readFileSync(resolve(process.cwd(), "public/basemap/sprites/dark.png"))[0]).toBe(137);
  });

  it("stamps the edition year onto the style source when the PMTiles URL changes", () => {
    const source = {
      type: "vector" as const,
      url: BASEMAP_SOURCE_URL,
      attribution: osBasemapAttribution(2026),
      minzoom: 0,
      maxzoom: 13,
    };
    expect(
      pointZoomstackSource(source, "https://blob.example/tiles/basemap/2027-03.pmtiles", 2027),
    ).toEqual({
      ...source,
      url: "pmtiles://https://blob.example/tiles/basemap/2027-03.pmtiles",
      attribution: osBasemapAttribution(2027),
    });
    const script = readFileSync(resolve(process.cwd(), "scripts/build-basemap.ts"), "utf8");
    expect(script).toContain("pointStylesAt(blob.url, year)");
    expect(script).toContain("source.attribution = pointed.attribution");
  });
});
