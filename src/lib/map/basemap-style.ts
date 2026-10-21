import {
  BASEMAP_FONTSTACK,
  BASEMAP_GLYPHS,
  BASEMAP_SOURCE_URL,
  BASEMAP_ZOOM_MAX,
  BASEMAP_ZOOM_MIN,
  MAP_MAX_BOUNDS,
  ZOOMSTACK_LAND_EXTENT,
  osBasemapAttribution,
} from "@/lib/map/constants";

export const BASEMAP_THEMES = ["light", "dark"] as const;
export type BasemapTheme = (typeof BASEMAP_THEMES)[number];

/**
 * Hex values copied from the Geist tokens in `src/app/globals.css`.
 * Water and woodland are desaturated washes so the basemap stays behind the data.
 *
 * Zoomstack publishes sea polygons only inside a box around Britain (about
 * 12°W–4°E, 49°N–62°N). Land is the part of that box the sea does not cover.
 * The map background is sea, so the rest of the canvas is water rather than
 * the page colour. A land polygon the size of the extract sits under the sea
 * fill. A second sea polygon covers the camera bounds, with a hole just inside
 * the extract, so the land rectangle cannot draw a beige frame in the ocean.
 * That hole still cuts mainland Europe on two straight edges. A sea fill above
 * the coast covers that land; its northern edge sits in the Dover Strait.
 * The coastline is a separate line. Sea polygons are clipped to each vector
 * tile, so outlining those fills draws the tile grid and the extract box.
 */
const THEME_COLORS = {
  light: {
    land: "#f3f1ec",
    sea: "#c5d7e6",
    coast: "#5e6d78",
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
    halo: "#f3f1ec",
  },
  dark: {
    land: "#2c2e32",
    sea: "#0d1b27",
    coast: "#8b98a4",
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
    halo: "#2c2e32",
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

/** How far the sea fill extends past the camera limit, in degrees. */
const SEA_MARGIN_DEGREES = 80;

/** Pull the sea hole inside the extract so it overlaps the tile sea, not the coast.
 * The extract edge sits in open water; 0.4° stays south of Scilly and east of Norfolk. */
const SEA_HOLE_INSET_DEGREES = 0.4;

function ring(west: number, south: number, east: number, north: number, clockwise: boolean): number[][] {
  const sw: number[] = [west, south];
  const se: number[] = [east, south];
  const ne: number[] = [east, north];
  const nw: number[] = [west, north];
  const ordered = clockwise ? [sw, nw, ne, se] : [sw, se, ne, nw];
  const close = ordered[0] ?? sw;
  return [...ordered, [close[0] ?? west, close[1] ?? south]];
}

function landExtentFeature(): Record<string, unknown> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        ring(
          ZOOMSTACK_LAND_EXTENT.west,
          ZOOMSTACK_LAND_EXTENT.south,
          ZOOMSTACK_LAND_EXTENT.east,
          ZOOMSTACK_LAND_EXTENT.north,
          false,
        ),
      ],
    },
  };
}

function seaMarginFeature(): Record<string, unknown> {
  const [[westLimit, southLimit], [eastLimit, northLimit]] = MAP_MAX_BOUNDS;
  const west = Math.max(-180, westLimit - SEA_MARGIN_DEGREES);
  const south = Math.max(-85, southLimit - SEA_MARGIN_DEGREES);
  const east = Math.min(180, eastLimit + SEA_MARGIN_DEGREES);
  const north = Math.min(85, northLimit + SEA_MARGIN_DEGREES);
  const holeWest = ZOOMSTACK_LAND_EXTENT.west + SEA_HOLE_INSET_DEGREES;
  const holeSouth = ZOOMSTACK_LAND_EXTENT.south + SEA_HOLE_INSET_DEGREES;
  const holeEast = ZOOMSTACK_LAND_EXTENT.east - SEA_HOLE_INSET_DEGREES;
  const holeNorth = ZOOMSTACK_LAND_EXTENT.north - SEA_HOLE_INSET_DEGREES;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [ring(west, south, east, north, false), ring(holeWest, holeSouth, holeEast, holeNorth, true)],
    },
  };
}

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

/**
 * Northern edge of the continental sea cover, west to east, through the
 * Strait of Dover. South of Kent (the English coast stays above 51.10°N
 * here) and north of the French shore. The ring closes east and south of
 * the Zoomstack extract, in water that is already sea.
 */
const SEA_CONTINENT_EDGE: readonly (readonly [number, number])[] = [
  [0.05, 49.684],
  [0.17, 49.809],
  [0.29, 49.855],
  [0.41, 49.865],
  [0.53, 49.937],
  [0.65, 49.956],
  [0.77, 49.956],
  [1.13, 50.059],
  [1.25, 50.088],
  [1.37, 50.212],
  [1.49, 50.948],
  [1.61, 51.007],
  [1.73, 51.024],
  [1.85, 51.076],
  [1.97, 51.087],
  [2.09, 51.1],
  [2.21, 51.1],
  [2.33, 51.139],
  [2.45, 51.149],
  [2.57, 51.182],
  [2.69, 51.25],
  [2.81, 51.25],
  [2.93, 51.326],
  [3.05, 51.41],
  [3.17, 51.41],
  [3.4, 51.72],
];

function seaContinentFeature(): Record<string, unknown> {
  const first = SEA_CONTINENT_EDGE[0] ?? [0, 50];
  const last = SEA_CONTINENT_EDGE[SEA_CONTINENT_EDGE.length - 1] ?? first;
  const coordinates = [
    ...SEA_CONTINENT_EDGE.map((point) => [point[0], point[1]]),
    [8, last[1]],
    [8, 47.5],
    [0, 47.5],
    [0, first[1]],
    [first[0], first[1]],
  ];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}

/** Country and capital points copied from z5. Zooms 0–4 have no names tiles. */
function overviewNames(color: string, halo: string): StyleLayer {
  return {
    id: "names-overview",
    type: "symbol",
    source: "place-names",
    maxzoom: 6,
    layout: {
      "text-field": ["get", "name1"],
      "text-font": [BASEMAP_FONTSTACK],
      "text-size": ["match", ["get", "type"], "Country", 14, 12],
      "symbol-sort-key": ["match", ["get", "type"], "Country", 0, 1],
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

function names(
  id: string,
  types: readonly string[],
  minzoom: number,
  size: number,
  color: string,
  halo: string,
): StyleLayer {
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
    {
      id: "background",
      type: "background",
      paint: { "background-color": color.sea },
    },
    {
      id: "land",
      type: "fill",
      source: "land-extent",
      paint: { "fill-color": color.land },
    },
    {
      id: "sea-margin",
      type: "fill",
      source: "sea-margin",
      paint: { "fill-color": color.sea, "fill-opacity": 1 },
    },
    {
      id: "sea",
      type: "fill",
      source: "zoomstack",
      "source-layer": "sea",
      minzoom: 0,
      paint: {
        "fill-color": color.sea,
        "fill-opacity": 1,
      },
    },
    {
      id: "coast",
      type: "line",
      source: "coastline",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color.coast,
        "line-width": 1.5,
      },
    },
    {
      id: "sea-continent",
      type: "fill",
      source: "sea-continent",
      paint: { "fill-color": color.sea, "fill-opacity": 1 },
    },
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
      filter: ["==", ["get", "type"], "National"],
      paint: { "line-color": color.boundary, "line-width": 0.6 },
    },
    overviewNames(color.label, color.halo),
    names("names-country", ["Country"], 6, 13, color.label, color.halo),
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
      "land-extent": {
        type: "geojson",
        data: landExtentFeature(),
      },
      "sea-margin": {
        type: "geojson",
        data: seaMarginFeature(),
      },
      "place-names": {
        type: "geojson",
        data: "/basemap/names.geojson",
        buffer: 256,
        tolerance: 0,
      },
      coastline: {
        type: "geojson",
        data: "/basemap/coastline.geojson",
      },
      "sea-continent": {
        type: "geojson",
        data: seaContinentFeature(),
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
