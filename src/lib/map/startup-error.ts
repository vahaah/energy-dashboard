/**
 * A style that never loads emits an error with no source id, and `style.load`
 * does not fire. Tile failures name the zoomstack source. Glyph and sprite
 * errors also omit a source id, but they arrive after the style has loaded,
 * and the basemap can still paint.
 */
export function basemapStartupFailed(event: object, styleLoaded: boolean, basemapLoaded: boolean): boolean {
  if (basemapLoaded) {
    return false;
  }
  const sourceId = Reflect.get(event, "sourceId");
  if (sourceId === "zoomstack") {
    return true;
  }
  return !styleLoaded && sourceId === undefined;
}
