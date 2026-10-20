import { describe, expect, it } from "vitest";
import { basemapStartupFailed } from "@/lib/map/startup-error";

describe("basemapStartupFailed", () => {
  it("fails a style error that has no source before the style loads", () => {
    expect(basemapStartupFailed({ error: { message: "missing style" } }, false, false)).toBe(true);
  });

  it("fails a zoomstack source error before the tiles load", () => {
    expect(basemapStartupFailed({ sourceId: "zoomstack" }, true, false)).toBe(true);
  });

  it("ignores a glyph error once the style has loaded", () => {
    expect(basemapStartupFailed({ error: { message: "glyph" } }, true, false)).toBe(false);
  });

  it("ignores later errors once the basemap source has loaded", () => {
    expect(basemapStartupFailed({ sourceId: "zoomstack" }, true, true)).toBe(false);
  });
});
