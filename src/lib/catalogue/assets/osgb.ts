import proj4 from "proj4";

/**
 * EPSG:27700, Airy 1830, OSGB36 to WGS84 7-parameter Helmert.
 * Good to a few metres. Not OSTN15. Enough to put a station on the right site.
 */
const OSGB36 =
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs";

proj4.defs("EPSG:27700", OSGB36);

export type Wgs84Point = {
  latitude: number;
  longitude: number;
};

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/**
 * British National Grid to WGS84. Missing or non-grid input, including (0, 0),
 * returns null so the row stays list-only. Never returns the origin.
 */
export function osgbToWgs84(easting: number, northing: number): Wgs84Point | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    return null;
  }
  if (easting === 0 && northing === 0) {
    return null;
  }
  if (easting < 0 || northing < 0 || easting > 900_000 || northing > 1_400_000) {
    return null;
  }
  const projected = proj4("EPSG:27700", "EPSG:4326", [easting, northing]);
  const longitude = projected[0];
  const latitude = projected[1];
  if (longitude === undefined || latitude === undefined) {
    return null;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude === 0 && longitude === 0) {
    return null;
  }
  return { latitude: round5(latitude), longitude: round5(longitude) };
}

/** Great-circle metres. Used to prove a transformed point is the station, not a random UK cell. */
export function distanceMetres(
  latitude: number,
  longitude: number,
  otherLatitude: number,
  otherLongitude: number,
): number {
  const earth = 6_371_000;
  const radians = Math.PI / 180;
  const latitudeDelta = (otherLatitude - latitude) * radians;
  const longitudeDelta = (otherLongitude - longitude) * radians;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude * radians) *
      Math.cos(otherLatitude * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}
