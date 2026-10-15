import proj4 from "proj4";
import { GEOJSON_BYTE_LIMIT } from "@/lib/map/constants";

/**
 * EPSG:27700, the same Airy 1830 / OSGB36 Helmert definition as the asset register.
 * Licence-area boundaries are approximate, so a few metres of datum error is inside the source warning.
 */
const OSGB36 =
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs";

proj4.defs("EPSG:27700", OSGB36);

export const SOURCE_CRS = ["EPSG:27700", "EPSG:4326"] as const;
export type SourceCrs = (typeof SOURCE_CRS)[number];

export type Position = [number, number];
export type LinearRing = Position[];
export type PolygonCoordinates = LinearRing[];
export type MultiPolygonCoordinates = PolygonCoordinates[];

export type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: PolygonCoordinates }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates };

export type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry;
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
  crs?: {
    type?: string;
    properties?: { name?: string };
  };
};

export type Bbox = [number, number, number, number];

export class CrsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrsError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

function epsgFromName(name: string): SourceCrs | null {
  if (name.includes("27700")) {
    return "EPSG:27700";
  }
  if (name.includes("4326")) {
    return "EPSG:4326";
  }
  return null;
}

function epsgFromMagnitude(position: Position): SourceCrs | null {
  const [x, y] = position;
  const looksGeographic = Math.abs(x) <= 180 && Math.abs(y) <= 90;
  if (looksGeographic) {
    return "EPSG:4326";
  }
  const looksOsgb = x >= 0 && x <= 800_000 && y >= 0 && y <= 1_400_000;
  if (looksOsgb) {
    return "EPSG:27700";
  }
  return null;
}

function firstPosition(value: unknown): Position | null {
  if (isPosition(value)) {
    return [value[0], value[1]];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  for (const child of value) {
    const found = firstPosition(child);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Read the GeoJSON `crs` member, then check it against the first coordinate.
 * A named CRS that disagrees with the coordinate magnitude is a hard error.
 */
export function detectSourceCrs(collection: GeoJsonFeatureCollection): SourceCrs {
  const name = collection.crs?.properties?.name ?? "";
  const named = name.length > 0 ? epsgFromName(name) : null;
  if (name.length > 0 && !named) {
    throw new CrsError(`unsupported CRS name ${name}`);
  }
  const sample = firstPosition(collection.features[0]?.geometry.coordinates);
  const inferred = sample ? epsgFromMagnitude(sample) : null;
  if (named && inferred && named !== inferred) {
    throw new CrsError(`CRS ${named} does not match coordinates that look like ${inferred}`);
  }
  if (named) {
    return named;
  }
  if (inferred) {
    return inferred;
  }
  throw new CrsError("could not detect a source CRS");
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

export function transformPosition(crs: SourceCrs, position: Position): Position {
  switch (crs) {
    case "EPSG:4326":
      return [position[0], position[1]];
    case "EPSG:27700": {
      const projected = proj4("EPSG:27700", "EPSG:4326", [position[0], position[1]]);
      const longitude = projected[0];
      const latitude = projected[1];
      if (longitude === undefined || latitude === undefined) {
        throw new CrsError("EPSG:27700 transform returned no coordinate");
      }
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        throw new CrsError("EPSG:27700 transform returned a non-finite coordinate");
      }
      return [longitude, latitude];
    }
    default: {
      const neverCrs: never = crs;
      throw new CrsError(`unsupported CRS ${neverCrs}`);
    }
  }
}

function transformRing(crs: SourceCrs, ring: LinearRing): LinearRing {
  return ring.map((position) => transformPosition(crs, position));
}

function transformGeometry(crs: SourceCrs, geometry: GeoJsonGeometry): GeoJsonGeometry {
  switch (geometry.type) {
    case "Polygon":
      return { type: "Polygon", coordinates: geometry.coordinates.map((ring) => transformRing(crs, ring)) };
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => transformRing(crs, ring))),
      };
    default: {
      const neverGeometry: never = geometry;
      throw new CrsError(`unsupported geometry ${neverGeometry}`);
    }
  }
}

function perpendicularDistance(point: Position, start: Position, end: Position): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
}

/** Iterative Douglas–Peucker. Keeps the endpoints. */
export function simplifyLine(points: readonly Position[], tolerance: number): Position[] {
  const count = points.length;
  if (count < 3) {
    return points.map((position) => [position[0], position[1]]);
  }
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const stack: Array<[number, number]> = [[0, count - 1]];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) {
      break;
    }
    const [start, end] = next;
    let maxDistance = 0;
    let index = -1;
    const origin = points[start];
    const destination = points[end];
    if (!origin || !destination) {
      continue;
    }
    for (let cursor = start + 1; cursor < end; cursor += 1) {
      const point = points[cursor];
      if (!point) {
        continue;
      }
      const distance = perpendicularDistance(point, origin, destination);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = cursor;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  const simplified: Position[] = [];
  for (let cursor = 0; cursor < count; cursor += 1) {
    if (keep[cursor]) {
      const point = points[cursor];
      if (point) {
        simplified.push([point[0], point[1]]);
      }
    }
  }
  return simplified;
}

function samePosition(left: Position, right: Position): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function roundRing(ring: LinearRing): LinearRing | null {
  const open = ring.length > 1 && samePosition(ring[0]!, ring[ring.length - 1]!) ? ring.slice(0, -1) : ring;
  const rounded: Position[] = [];
  for (const position of open) {
    const next: Position = [round5(position[0]), round5(position[1])];
    const previous = rounded[rounded.length - 1];
    if (!previous || !samePosition(previous, next)) {
      rounded.push(next);
    }
  }
  if (rounded.length < 3) {
    return null;
  }
  const first = rounded[0];
  if (!first) {
    return null;
  }
  rounded.push([first[0], first[1]]);
  return rounded.length >= 4 ? rounded : null;
}

function simplifyRing(ring: LinearRing, tolerance: number): LinearRing | null {
  const open = ring.length > 1 && samePosition(ring[0]!, ring[ring.length - 1]!) ? ring.slice(0, -1) : ring;
  if (open.length < 3) {
    return null;
  }
  const simplified = simplifyLine(open, tolerance);
  if (simplified.length < 3) {
    return null;
  }
  const first = simplified[0];
  if (!first) {
    return null;
  }
  simplified.push([first[0], first[1]]);
  return roundRing(simplified);
}

function simplifyPolygon(polygon: PolygonCoordinates, tolerance: number): PolygonCoordinates | null {
  const rings: LinearRing[] = [];
  for (const ring of polygon) {
    const simplified = simplifyRing(ring, tolerance);
    if (simplified) {
      rings.push(simplified);
    }
  }
  if (rings.length === 0) {
    return null;
  }
  return rings;
}

function simplifyGeometry(geometry: GeoJsonGeometry, tolerance: number): GeoJsonGeometry | null {
  switch (geometry.type) {
    case "Polygon": {
      const polygon = simplifyPolygon(geometry.coordinates, tolerance);
      return polygon ? { type: "Polygon", coordinates: polygon } : null;
    }
    case "MultiPolygon": {
      const polygons: MultiPolygonCoordinates = [];
      for (const polygon of geometry.coordinates) {
        const simplified = simplifyPolygon(polygon, tolerance);
        if (simplified) {
          polygons.push(simplified);
        }
      }
      return polygons.length > 0 ? { type: "MultiPolygon", coordinates: polygons } : null;
    }
    default: {
      const neverGeometry: never = geometry;
      throw new CrsError(`unsupported geometry ${neverGeometry}`);
    }
  }
}

function extendBbox(bbox: Bbox, position: Position): Bbox {
  return [
    Math.min(bbox[0], position[0]),
    Math.min(bbox[1], position[1]),
    Math.max(bbox[2], position[0]),
    Math.max(bbox[3], position[1]),
  ];
}

function ringBbox(ring: LinearRing, bbox: Bbox | null): Bbox | null {
  let next = bbox;
  for (const position of ring) {
    next = next ? extendBbox(next, position) : [position[0], position[1], position[0], position[1]];
  }
  return next;
}

export function geometryBbox(geometry: GeoJsonGeometry): Bbox | null {
  let bbox: Bbox | null = null;
  switch (geometry.type) {
    case "Polygon":
      for (const ring of geometry.coordinates) {
        bbox = ringBbox(ring, bbox);
      }
      return bbox;
    case "MultiPolygon":
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          bbox = ringBbox(ring, bbox);
        }
      }
      return bbox;
    default: {
      const neverGeometry: never = geometry;
      throw new CrsError(`unsupported geometry ${neverGeometry}`);
    }
  }
}

function pointInRing(point: Position, ring: LinearRing): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const start = ring[index];
    const end = ring[previous];
    if (!start || !end) {
      continue;
    }
    const crosses = start[1] > point[1] !== end[1] > point[1];
    if (!crosses) {
      continue;
    }
    const x = ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0];
    if (point[0] < x) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point: Position, polygon: PolygonCoordinates): boolean {
  const outer = polygon[0];
  if (!outer || !pointInRing(point, outer)) {
    return false;
  }
  for (let index = 1; index < polygon.length; index += 1) {
    const hole = polygon[index];
    if (hole && pointInRing(point, hole)) {
      return false;
    }
  }
  return true;
}

export function pointInGeometry(longitude: number, latitude: number, geometry: GeoJsonGeometry): boolean {
  const point: Position = [longitude, latitude];
  switch (geometry.type) {
    case "Polygon":
      return pointInPolygon(point, geometry.coordinates);
    case "MultiPolygon":
      return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
    default: {
      const neverGeometry: never = geometry;
      throw new CrsError(`unsupported geometry ${neverGeometry}`);
    }
  }
}

export function featureArea(feature: GeoJsonFeature): string | null {
  const area = feature.properties.Area;
  return typeof area === "string" && area.length > 0 ? area : null;
}

export function areaAt(
  features: readonly GeoJsonFeature[],
  longitude: number,
  latitude: number,
): string | null {
  for (const feature of features) {
    if (pointInGeometry(longitude, latitude, feature.geometry)) {
      return featureArea(feature);
    }
  }
  return null;
}

function parseGeometry(value: unknown): GeoJsonGeometry | null {
  if (!isRecord(value) || typeof value.type !== "string" || !Array.isArray(value.coordinates)) {
    return null;
  }
  if (value.type === "Polygon" || value.type === "MultiPolygon") {
    return value as GeoJsonGeometry;
  }
  return null;
}

export function parseFeatureCollection(value: unknown): GeoJsonFeatureCollection {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    throw new CrsError("expected a GeoJSON FeatureCollection");
  }
  const features: GeoJsonFeature[] = [];
  for (const feature of value.features) {
    if (!isRecord(feature) || feature.type !== "Feature" || !isRecord(feature.properties)) {
      throw new CrsError("expected Feature properties");
    }
    const geometry = parseGeometry(feature.geometry);
    if (!geometry) {
      throw new CrsError("expected Polygon or MultiPolygon features");
    }
    features.push({ type: "Feature", properties: feature.properties, geometry });
  }
  const collection: GeoJsonFeatureCollection = { type: "FeatureCollection", features };
  if (isRecord(value.crs)) {
    const properties = isRecord(value.crs.properties) ? value.crs.properties : undefined;
    const name = typeof properties?.name === "string" ? properties.name : undefined;
    collection.crs = {
      type: typeof value.crs.type === "string" ? value.crs.type : undefined,
      properties: name ? { name } : undefined,
    };
  }
  return collection;
}

export type PublishedDno = {
  collection: GeoJsonFeatureCollection;
  sourceCrs: SourceCrs;
  bbox: Bbox;
  bytes: number;
  body: string;
  kind: "geojson" | "pmtiles";
};

/**
 * Detect the source CRS, transform to EPSG:4326, simplify, and drop the `crs`
 * member. RFC 7946 GeoJSON is WGS84 and does not carry a CRS.
 */
export function publishDnoCollection(
  value: unknown,
  tolerance: number,
): PublishedDno {
  const source = parseFeatureCollection(value);
  const sourceCrs = detectSourceCrs(source);
  const features: GeoJsonFeature[] = [];
  for (const feature of source.features) {
    const transformed = transformGeometry(sourceCrs, feature.geometry);
    const simplified = simplifyGeometry(transformed, tolerance);
    if (!simplified) {
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        ID: feature.properties.ID ?? null,
        Name: feature.properties.Name ?? null,
        DNO: feature.properties.DNO ?? null,
        Area: feature.properties.Area ?? null,
        DNO_Full: feature.properties.DNO_Full ?? null,
      },
      geometry: simplified,
    });
  }
  if (features.length === 0) {
    throw new CrsError("simplification removed every DNO polygon");
  }
  const collection: GeoJsonFeatureCollection = { type: "FeatureCollection", features };
  let bbox: Bbox | null = null;
  for (const feature of features) {
    const featureBbox = geometryBbox(feature.geometry);
    if (!featureBbox) {
      continue;
    }
    bbox = bbox
      ? [
          Math.min(bbox[0], featureBbox[0]),
          Math.min(bbox[1], featureBbox[1]),
          Math.max(bbox[2], featureBbox[2]),
          Math.max(bbox[3], featureBbox[3]),
        ]
      : featureBbox;
  }
  if (!bbox) {
    throw new CrsError("DNO polygons have no bbox");
  }
  const body = JSON.stringify(collection);
  const bytes = Buffer.byteLength(body);
  return {
    collection,
    sourceCrs,
    bbox,
    bytes,
    body,
    kind: bytes < GEOJSON_BYTE_LIMIT ? "geojson" : "pmtiles",
  };
}
