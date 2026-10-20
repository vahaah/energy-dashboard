export type Ring = readonly (readonly [number, number])[];
export type Polygon = readonly Ring[];

export type GeoJsonGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export type IndexedFeature = {
  id: string;
  name: string;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  polygons: Polygon[];
};

export type LocateHit =
  | { kind: "none" }
  | { kind: "one"; feature: IndexedFeature }
  | { kind: "overlap" };

function pointInRing(longitude: number, latitude: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const current = ring[i];
    const previous = ring[j];
    if (!current || !previous) {
      continue;
    }
    const [xi, yi] = current;
    const [xj, yj] = previous;
    const crosses = yi > latitude !== yj > latitude;
    if (crosses && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(longitude: number, latitude: number, polygon: Polygon): boolean {
  const outer = polygon[0];
  if (!outer || !pointInRing(longitude, latitude, outer)) {
    return false;
  }
  for (let index = 1; index < polygon.length; index += 1) {
    const hole = polygon[index];
    if (hole && pointInRing(longitude, latitude, hole)) {
      return false;
    }
  }
  return true;
}

function asRing(value: number[][]): Ring {
  return value.filter((pair): pair is [number, number] => pair.length >= 2);
}

export function polygonsOf(geometry: GeoJsonGeometry): Polygon[] {
  if (geometry.type === "Polygon") {
    return [(geometry.coordinates as number[][][]).map(asRing)];
  }
  return (geometry.coordinates as number[][][][]).map((polygon) => polygon.map(asRing));
}

export function indexFeatures(
  features: readonly { id: string; name: string; geometry: GeoJsonGeometry }[],
): IndexedFeature[] {
  return features.map((feature) => {
    const polygons = polygonsOf(feature.geometry);
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          minLon = Math.min(minLon, lon);
          minLat = Math.min(minLat, lat);
          maxLon = Math.max(maxLon, lon);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }
    return {
      id: feature.id,
      name: feature.name,
      minLon,
      minLat,
      maxLon,
      maxLat,
      polygons,
    };
  });
}

function inBox(feature: IndexedFeature, longitude: number, latitude: number): boolean {
  return (
    longitude >= feature.minLon &&
    longitude <= feature.maxLon &&
    latitude >= feature.minLat &&
    latitude <= feature.maxLat
  );
}

/** One containing feature. Overlap is not resolved by picking a neighbour. */
export function locate(
  features: readonly IndexedFeature[],
  longitude: number,
  latitude: number,
): LocateHit {
  let hit: IndexedFeature | null = null;
  for (const feature of features) {
    if (!inBox(feature, longitude, latitude)) {
      continue;
    }
    const inside = feature.polygons.some((polygon) => pointInPolygon(longitude, latitude, polygon));
    if (!inside) {
      continue;
    }
    if (hit) {
      return { kind: "overlap" };
    }
    hit = feature;
  }
  return hit ? { kind: "one", feature: hit } : { kind: "none" };
}
