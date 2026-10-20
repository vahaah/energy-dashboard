import {
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  OGL_V3_ATTRIBUTION,
  OGL_V3_LICENCE_URL,
} from "@/lib/attribution";

/** OS Open Zoomstack vector tiles. The product API reports the edition. */
export const OS_ZOOMSTACK_PRODUCT_URL = "https://api.os.uk/downloads/v1/products/OpenZoomstack";

export const OS_ZOOMSTACK_DOWNLOAD_URL =
  "https://api.os.uk/downloads/v1/products/OpenZoomstack/downloads?area=GB&format=Vector+Tiles&subformat=%28MBTiles%29&redirect";

export const BASEMAP_ZOOM_MIN = 0;
export const BASEMAP_ZOOM_MAX = 13;

/**
 * First zoom that carries country labels, motorways, and urban areas in the
 * OS Open Zoomstack vector tiles. Zoom 0–4 is sea only, so a wider view never
 * requests glyphs. This is the opening zoom, not the camera minimum: the
 * overview has to fit Britain on a phone. Remote endpoints stay inside
 * MAP_MAX_BOUNDS and are framed when that link is selected.
 */
export const BASEMAP_DETAIL_MIN_ZOOM = 5;

/** Lowest zoom the camera allows. The overview on a 375px screen sits below the label zoom. */
export const MAP_CAMERA_MIN_ZOOM = 3;

/**
 * Geographic box of the sea features in the 2026-06 Zoomstack archive.
 * Land is this box with the sea polygons punched out. Past the edge the
 * archive has no land, so the fill ends in a straight cut.
 */
export const ZOOMSTACK_LAND_EXTENT = {
  west: -11.865234375,
  south: 49.38237278700956,
  east: 3.603515625,
  north: 61.56457388515458,
} as const;

/**
 * Camera limit. This is the schematic box (west -12, south 47, east 14, north 64):
 * every interconnector endpoint, including NSL, Viking, and IFA2, sits inside it
 * and can be panned into view. `basemap-style.test.ts` checks it against `SCHEMATIC_BBOX`.
 */
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-12, 47],
  [14, 64],
];

/**
 * Overview fit, inset from the Zoomstack extract. The land fill ends in a
 * straight cut, and this keeps that cut off-screen on the opening frame.
 * A selected link uses `MAP_MAX_BOUNDS` instead, so a remote endpoint outside
 * this inset is still reachable.
 */
export const OVERVIEW_CAMERA_LIMIT: [[number, number], [number, number]] = [
  [ZOOMSTACK_LAND_EXTENT.west + 0.4, ZOOMSTACK_LAND_EXTENT.south + 0.3],
  [ZOOMSTACK_LAND_EXTENT.east - 0.4, ZOOMSTACK_LAND_EXTENT.north - 0.25],
];

function clampBox(
  bounds: { west: number; south: number; east: number; north: number },
  limit: [[number, number], [number, number]],
): { west: number; south: number; east: number; north: number } {
  const [[westLimit, southLimit], [eastLimit, northLimit]] = limit;
  return {
    west: Math.min(Math.max(bounds.west, westLimit), eastLimit),
    east: Math.max(Math.min(bounds.east, eastLimit), westLimit),
    south: Math.min(Math.max(bounds.south, southLimit), northLimit),
    north: Math.max(Math.min(bounds.north, northLimit), southLimit),
  };
}

export function clampToMapBounds(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}): { west: number; south: number; east: number; north: number } {
  return clampBox(bounds, MAP_MAX_BOUNDS);
}

export function clampOverviewBounds(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}): { west: number; south: number; east: number; north: number } {
  return clampBox(bounds, OVERVIEW_CAMERA_LIMIT);
}

/** Closed height of the mobile flow sheet. The overview padding clears it. */
export const FLOW_SHEET_PEEK_PX = 140 as const;

/** England, Scotland, and Wales, including the Outer Hebrides and Shetland. */
export const GB_FRAME_BOUNDS: { west: number; south: number; east: number; north: number } = {
  west: -8.2,
  south: 49.85,
  east: 1.85,
  north: 60.86,
};

export const BASEMAP_LAYER_ID = "basemap";
export const DNO_LAYER_ID = "dno";

/** Placeholder until `scripts/build-basemap.ts` uploads the PMTiles archive. */
export const BASEMAP_SOURCE_URL = "pmtiles://catalogue:basemap";

export const BASEMAP_GLYPHS = "/basemap/glyphs/{fontstack}/{range}.pbf";
export const BASEMAP_FONTSTACK = "Geist Sans Regular";

export const NESO_DNO_PACKAGE_URL =
  "https://api.neso.energy/api/3/action/package_show?id=gis-boundaries-for-gb-dno-license-areas";

/** Douglas–Peucker tolerance in degrees after the transform to EPSG:4326. About 110 m. */
export const DNO_SIMPLIFY_TOLERANCE_DEGREES = 0.001;

/** Decimal megabyte. At or above this, the DNO layer is PMTiles instead of GeoJSON. */
export const GEOJSON_BYTE_LIMIT = 1_000_000;

export const DNO_PRECISION = "published_approximate" as const;
export const BASEMAP_PRECISION = "published_approximate" as const;

export const NESO_DNO_ACCURACY_WARNING =
  "The boundaries in this dataset were originally shared by Western Power Distribution, now National Grid Electricity Distribution (the DNO responsible for 4 of the 14 Licence Areas) and come with the disclaimer that they are probably a little outdated and not 100% accurate.";

export const DNO_ATTRIBUTION = `${NESO_OPEN_DATA_ATTRIBUTION}. ${OGL_V3_ATTRIBUTION}`;

export const DNO_LICENCE = "NESO Open Data Licence";
export const DNO_LICENCE_URL = NESO_OPEN_DATA_LICENCE_URL;

export const OS_LICENCE = "Open Government Licence v3.0";
export const OS_LICENCE_URL = OGL_V3_LICENCE_URL;

export function osBasemapAttribution(year: number): string {
  return `Contains OS data © Crown copyright and database right ${year}`;
}

export const REDIS_DNO_POINTER_KEY = "grid:map-layer:dno";

export type DnoSamplePoint = {
  name: string;
  latitude: number;
  longitude: number;
  area: string;
};

/** WGS84 city centres used to prove the transformed licence areas. */
export const DNO_SAMPLE_POINTS: readonly DnoSamplePoint[] = [
  { name: "Central London", latitude: 51.5074, longitude: -0.1278, area: "London" },
  { name: "Manchester", latitude: 53.4808, longitude: -2.2426, area: "North West England" },
  { name: "Liverpool", latitude: 53.4084, longitude: -2.9916, area: "North Wales, Merseyside and Cheshire" },
  { name: "Edinburgh", latitude: 55.9533, longitude: -3.1883, area: "South and Central Scotland" },
  { name: "Glasgow", latitude: 55.8642, longitude: -4.2518, area: "South and Central Scotland" },
  { name: "Aberdeen", latitude: 57.1497, longitude: -2.0943, area: "North Scotland" },
  { name: "Cardiff", latitude: 51.4816, longitude: -3.1791, area: "South Wales" },
  { name: "Birmingham", latitude: 52.4862, longitude: -1.8904, area: "West Midlands" },
  { name: "Nottingham", latitude: 52.9548, longitude: -1.1581, area: "East Midlands" },
  { name: "Leeds", latitude: 53.8008, longitude: -1.5491, area: "Yorkshire" },
  { name: "Newcastle", latitude: 54.9783, longitude: -1.6178, area: "North East England" },
  { name: "Plymouth", latitude: 50.3755, longitude: -4.1427, area: "South West England" },
  { name: "Brighton", latitude: 50.8225, longitude: -0.1372, area: "South East England" },
  { name: "Norwich", latitude: 52.6309, longitude: 1.2974, area: "East England" },
  { name: "Southampton", latitude: 50.9097, longitude: -1.4044, area: "Southern England" },
];
