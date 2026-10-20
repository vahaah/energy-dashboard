import type { StyleSpecification } from "maplibre-gl";

/**
 * MapLibre 6.14 rejects a root-relative sprite (`new URL("/basemap/sprites/dark")` throws).
 * Glyph templates must stay literal: `new URL` percent-encodes `{fontstack}` and `{range}`,
 * so the glyph manager never substitutes them. Checked-in style JSON stays origin-agnostic.
 */
export function absolutiseBasemapStyle(style: StyleSpecification, origin: string): StyleSpecification {
  const sprite = typeof style.sprite === "string" ? new URL(style.sprite, origin).href : style.sprite;
  const glyphs = typeof style.glyphs === "string" ? origin + style.glyphs : style.glyphs;
  return { ...style, sprite, glyphs };
}

export function transformBasemapStyle(
  _previous: StyleSpecification | undefined,
  next: StyleSpecification,
): StyleSpecification {
  return absolutiseBasemapStyle(next, location.origin);
}
