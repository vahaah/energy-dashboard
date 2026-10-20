import { ciRegionShortname, type CiRegionId } from "@/lib/postcode/areas";
import {
  indexFeatures,
  polygonsOf,
  type GeoJsonFeatureCollection,
  type GeoJsonGeometry,
  type IndexedFeature,
} from "@/lib/postcode/geometry";

/** Checked-in NESO DNO licence areas, edition 20240503. */
export const DNO_GEOJSON_PATH = "public/tiles/layers/dno/20240503.geojson";

/**
 * DNO licence area id, the polygon `Area` name, and the Carbon Intensity
 * region whose boundary NESO draws on that same licence area. The resolver
 * does not import this table. The build stamps two feature collections and
 * looks each point up in both.
 */
export const DNO_LICENCE_AREAS = [
  { id: "ukpn-east", name: "East England", ciRegionId: 10 },
  { id: "nged-east-midlands", name: "East Midlands", ciRegionId: 9 },
  { id: "ukpn-london", name: "London", ciRegionId: 13 },
  { id: "spen-manweb", name: "North Wales, Merseyside and Cheshire", ciRegionId: 6 },
  { id: "nged-west-midlands", name: "West Midlands", ciRegionId: 8 },
  { id: "npg-northeast", name: "North East England", ciRegionId: 4 },
  { id: "enwl", name: "North West England", ciRegionId: 3 },
  { id: "ssen-north", name: "North Scotland", ciRegionId: 1 },
  { id: "ukpn-south-east", name: "South East England", ciRegionId: 14 },
  { id: "nged-south-wales", name: "South Wales", ciRegionId: 7 },
  { id: "nged-south-west", name: "South West England", ciRegionId: 11 },
  { id: "npg-yorkshire", name: "Yorkshire", ciRegionId: 5 },
  { id: "spen-distribution", name: "South and Central Scotland", ciRegionId: 2 },
  { id: "ssen-southern", name: "Southern England", ciRegionId: 12 },
] as const;

export type DnoAreaId = (typeof DNO_LICENCE_AREAS)[number]["id"];

const BY_NAME = new Map<string, (typeof DNO_LICENCE_AREAS)[number]>(
  DNO_LICENCE_AREAS.map((area) => [area.name, area]),
);

function licenceOf(name: string) {
  const area = BY_NAME.get(name);
  if (!area) {
    throw new Error(`DNO licence area ${name} is not in the 14`);
  }
  return area;
}

function geometryOf(feature: GeoJsonFeatureCollection["features"][number]): GeoJsonGeometry {
  const geometry = feature.geometry;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
    throw new Error("DNO feature has no polygon");
  }
  return geometry;
}

/** DNO properties are the licence-area id and the NESO area name. */
export function indexDnoAreas(collection: GeoJsonFeatureCollection): IndexedFeature[] {
  const seen = new Set<string>();
  const features = collection.features.map((feature) => {
    const name = feature.properties.Area;
    if (typeof name !== "string") {
      throw new Error("DNO feature is missing Area");
    }
    const area = licenceOf(name);
    seen.add(area.id);
    return { id: area.id, name: area.name, geometry: geometryOf(feature) };
  });
  if (seen.size !== DNO_LICENCE_AREAS.length) {
    throw new Error("DNO file does not cover every licence area");
  }
  return indexFeatures(features);
}

/**
 * A second collection. Properties are the Carbon Intensity region id and
 * shortname, not the DNO area name. Geometry is the NESO boundary NESO uses
 * for that region.
 */
export function indexCarbonRegions(collection: GeoJsonFeatureCollection): IndexedFeature[] {
  const seen = new Set<number>();
  const features = collection.features.map((feature) => {
    const name = feature.properties.Area;
    if (typeof name !== "string") {
      throw new Error("DNO feature is missing Area");
    }
    const area = licenceOf(name);
    const regionId = area.ciRegionId as CiRegionId;
    seen.add(regionId);
    return {
      id: String(regionId),
      name: ciRegionShortname(regionId),
      geometry: geometryOf(feature),
    };
  });
  if (seen.size !== DNO_LICENCE_AREAS.length) {
    throw new Error("Carbon Intensity layer does not cover regions 1 to 14");
  }
  return indexFeatures(features);
}

export function polygonCount(collection: GeoJsonFeatureCollection): number {
  return collection.features.reduce((sum, feature) => {
    if (!feature.geometry) {
      return sum;
    }
    return sum + polygonsOf(feature.geometry).length;
  }, 0);
}
