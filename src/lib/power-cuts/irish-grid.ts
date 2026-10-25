import proj4 from "proj4";

/**
 * EPSG:29903, Irish Grid (TM75 / Airy modified) to WGS84.
 * NIE publishes easting,northing in this grid.
 */
const IRISH_GRID =
  "+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +ellps=mod_airy +towgs84=482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15 +units=m +no_defs";

proj4.defs("EPSG:29903", IRISH_GRID);

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/** `[lon, lat]`. `(0, 0)` and anything outside the island box is null. */
export function irishGridToWgs84(easting: number, northing: number): [number, number] | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    return null;
  }
  if (easting === 0 && northing === 0) {
    return null;
  }
  if (easting < 0 || northing < 0 || easting > 500_000 || northing > 500_000) {
    return null;
  }
  const projected = proj4("EPSG:29903", "EPSG:4326", [easting, northing]);
  const longitude = projected[0];
  const latitude = projected[1];
  if (longitude === undefined || latitude === undefined) {
    return null;
  }
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  if (longitude === 0 && latitude === 0) {
    return null;
  }
  if (longitude < -10 || longitude > -5 || latitude < 53.5 || latitude > 55.5) {
    return null;
  }
  return [round5(longitude), round5(latitude)];
}

export function parseIrishPair(value: unknown): [number, number] | null {
  if (typeof value !== "string") {
    return null;
  }
  const [east, north] = value.split(",").map((part) => Number(part.trim()));
  if (east === undefined || north === undefined) {
    return null;
  }
  return irishGridToWgs84(east, north);
}
