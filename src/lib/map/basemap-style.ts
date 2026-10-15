import {
  BASEMAP_FONTSTACK,
  BASEMAP_GLYPHS,
  BASEMAP_SOURCE_URL,
  BASEMAP_ZOOM_MAX,
  BASEMAP_ZOOM_MIN,
  osBasemapAttribution,
} from "@/lib/map/constants";

export const BASEMAP_THEMES = ["light", "dark"] as const;
export type BasemapTheme = (typeof BASEMAP_THEMES)[number];

/**
 * Hex values copied from the Geist tokens in `src/app/globals.css`.
 * Water and woodland are desaturated washes so the basemap stays behind the data.
 */
const THEME_COLORS = {
  light: {
    background: "#fafafa",
    sea: "#e7eef3",
    foreshore: "#eef3f6",
    woodland: "#e6f0ea",
    urban: "#f5f5f5",
    building: "#ebebeb",
    water: "#d5e3ee",
    roadLocal: "#d4d4d4",
    roadSecondary: "#a3a3a3",
    roadPrimary: "#737373",
    motorway: "#525252",
    rail: "#d4d4d4",
    boundary: "#e5e5e5",
    label: "#525252",
    halo: "#ffffff",
  },
  dark: {
    background: "#0a0a0a",
    sea: "#101820",
    foreshore: "#141c24",
    woodland: "#122018",
    urban: "#1a1a1a",
    building: "#1f1f1f",
    water: "#1a3344",
    roadLocal: "#2e2e2e",
    roadSecondary: "#454545",
    roadPrimary: "#6b6b6b",
    motorway: "#8f8f8f",
    rail: "#2e2e2e",
    boundary: "#262626",
    label: "#a1a1a1",
    halo: "#0a0a0a",
  },
} as const;

type ThemeColors = (typeof THEME_COLORS)[BasemapTheme];

type StyleLayer = {
  id: string;
  type: string;
  source?: string;
  "source-layer"?: string;
  minzoom?: number;
  maxzoom?: number;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

function fill(id: string, sourceLayer: string, color: string, minzoom: number, maxzoom?: number): StyleLayer {
  return {
    id,
    type: "fill",
    source: "zoomstack",
    "source-layer": sourceLayer,
    minzoom,
    ...(maxzoom !== undefined ? { maxzoom } : {}),
    paint: { "fill-color": color, "fill-opacity": 1 },
  };
}

function roadWidth(minzoom: number, width: [number, number, number]): unknown[] {
  const stops: number[] = [];
  const add = (zoom: number, value: number) => {
    const previous = stops.length >= 2 ? stops[stops.length - 2] : -1;
    if (zoom > previous) {
      stops.push(zoom, value);
      return;
    }
    if (zoom === previous) {
      stops[stops.length - 1] = value;
    }
  };
  add(minzoom, width[0]);
  add(10, width[1]);
  add(13, width[2]);
  return ["interpolate", ["linear"], ["zoom"], ...stops];
}

function road(
  id: string,
  roadType: string,
  color: string,
  minzoom: number,
  width: [number, number, number],
): StyleLayer {
  return {
    id,
    type: "line",
    source: "zoomstack",
    "source-layer": "roads",
    minzoom,
    filter: ["==", ["get", "type"], roadType],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": color,
      "line-width": roadWidth(minzoom, width),
      "line-opacity": 0.9,
    },
  };
}

function names(id: string, types: readonly string[], minzoom: number, size: number, color: string, halo: string): StyleLayer {
  return {
    id,
    type: "symbol",
    source: "zoomstack",
    "source-layer": "names",
    minzoom,
    filter: ["match", ["get", "type"], [...types], true, false],
    layout: {
      "text-field": ["get", "name1"],
      "text-font": [BASEMAP_FONTSTACK],
      "text-size": size,
      "text-max-width": 8,
      "text-padding": 4,
    },
    paint: {
      "text-color": color,
      "text-halo-color": halo,
      "text-halo-width": 1.2,
    },
  };
}

export function basemapStyle(theme: BasemapTheme, copyrightYear: number): Record<string, unknown> {
  const color = THEME_COLORS[theme];
  const layers: StyleLayer[] = [
    { id: "background", type: "background", paint: { "background-color": color.background } },
    fill("sea", "sea", color.sea, 0),
    fill("urban-areas", "urban_areas", color.urban, 5, 11),
    fill("woodland", "woodland", color.woodland, 6),
    fill("foreshore", "foreshore", color.foreshore, 8),
    fill("surfacewater", "surfacewater", color.water, 6),
    fill("buildings", "buildings", color.building, 13),
    road("roads-local", "Local", color.roadLocal, 12, [0.2, 0.4, 0.8]),
    road("roads-restricted", "Restricted", color.roadLocal, 12, [0.2, 0.3, 0.6]),
    road("roads-minor", "Minor", color.roadLocal, 11, [0.3, 0.5, 1]),
    road("roads-b", "B Road", color.roadSecondary, 10, [0.4, 0.7, 1.2]),
    road("roads-a", "A Road", color.roadSecondary, 8, [0.4, 0.8, 1.4]),
    road("roads-primary", "Primary", color.roadPrimary, 5, [0.5, 1, 1.8]),
    road("roads-motorway", "Motorway", color.motorway, 5, [0.6, 1.2, 2.2]),
    {
      id: "rail",
      type: "line",
      source: "zoomstack",
      "source-layer": "rail",
      minzoom: 10,
      paint: {
        "line-color": color.rail,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 13, 1],
        "line-dasharray": [2, 2],
      },
    },
    {
      id: "boundaries",
      type: "line",
      source: "zoomstack",
      "source-layer": "boundaries",
      minzoom: 5,
      paint: { "line-color": color.boundary, "line-width": 0.6 },
    },
    names("names-country", ["Country"], 4, 13, color.label, color.halo),
    names("names-city", ["Capital", "City"], 6, 12, color.label, color.halo),
    names("names-town", ["Town"], 8, 11, color.label, color.halo),
  ];

  return {
    version: 8,
    name: `Grid basemap ${theme}`,
    metadata: {
      "grid:theme": theme,
      "grid:basemap": "catalogue:basemap",
      "grid:zoom": `${BASEMAP_ZOOM_MIN}-${BASEMAP_ZOOM_MAX}`,
    },
    sources: {
      zoomstack: {
        type: "vector",
        url: BASEMAP_SOURCE_URL,
        attribution: osBasemapAttribution(copyrightYear),
        minzoom: BASEMAP_ZOOM_MIN,
        maxzoom: BASEMAP_ZOOM_MAX,
      },
    },
    sprite: `/basemap/sprites/${theme}`,
    glyphs: BASEMAP_GLYPHS,
    layers,
  };
}

/** Point a checked-in style at a published PMTiles archive and that edition's crown year. */
export function pointZoomstackSource<T extends { url: string; attribution: string }>(
  source: T,
  blobUrl: string,
  copyrightYear: number,
): T {
  return {
    ...source,
    url: `pmtiles://${blobUrl}`,
    attribution: osBasemapAttribution(copyrightYear),
  };
}

export function basemapStyleJson(theme: BasemapTheme, copyrightYear: number): string {
  return `${JSON.stringify(basemapStyle(theme, copyrightYear), null, 2)}\n`;
}

export function themeColor(theme: BasemapTheme, token: keyof ThemeColors): string {
  return THEME_COLORS[theme][token];
}
