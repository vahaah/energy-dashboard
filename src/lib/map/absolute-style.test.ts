import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { absolutiseBasemapStyle } from "@/lib/map/absolute-style";

const origin = "https://grid.vahaah.com";

function style(partial: Pick<StyleSpecification, "sprite" | "glyphs">): StyleSpecification {
  return { version: 8, sources: {}, layers: [], ...partial };
}

describe("absolutiseBasemapStyle", () => {
  it("absolutises a root-relative sprite and concatenates glyph templates", () => {
    const glyphs = "/basemap/glyphs/{fontstack}/{range}.pbf";
    const next = absolutiseBasemapStyle(
      style({ sprite: "/basemap/sprites/dark", glyphs }),
      origin,
    );
    expect(next.sprite).toBe("https://grid.vahaah.com/basemap/sprites/dark");
    expect(next.glyphs).toBe("https://grid.vahaah.com/basemap/glyphs/{fontstack}/{range}.pbf");
    expect(new URL(glyphs, origin).href).toBe(
      "https://grid.vahaah.com/basemap/glyphs/%7Bfontstack%7D/%7Brange%7D.pbf",
    );
    expect(next.glyphs).not.toContain("%7B");
  });

  it("leaves a missing sprite and glyphs unset", () => {
    expect(absolutiseBasemapStyle(style({}), origin)).toEqual(style({ sprite: undefined, glyphs: undefined }));
  });

  it("keeps checked-in styles origin-agnostic", () => {
    for (const theme of ["light", "dark"] as const) {
      const checkedIn = JSON.parse(readFileSync(resolve(process.cwd(), `public/basemap/style-${theme}.json`), "utf8")) as {
        sprite: string;
        glyphs: string;
      };
      expect(checkedIn.sprite).toBe(`/basemap/sprites/${theme}`);
      expect(checkedIn.glyphs).toBe("/basemap/glyphs/{fontstack}/{range}.pbf");
    }
  });

  it("passes the same transform into both MapLibre mounts and logs dev errors", () => {
    for (const file of ["src/lib/map/flows-browser.ts", "src/lib/map/browser.ts"]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).toContain("transformStyle");
      expect(source).toContain("map.setStyle(styleUrl(theme), { transformStyle })");
      expect(source).toContain("map.setStyle(styleUrl(next), { transformStyle })");
      expect(source).toContain('process.env.NODE_ENV === "development"');
      expect(source).toContain("console.error(ev.error)");
      expect(source).not.toMatch(/new URL\([^)]*glyphs/);
    }
  });
});
