import type { MapPoint } from "@/lib/assets/types";
import { isCatalogueStation } from "@/lib/assets/types";
import { groupForStation, sizeStepForMw, type MapShape, type MapTechnologyGroupId } from "@/lib/map/symbols";
import type { Technology } from "@/lib/catalogue/assets/technologies";

export type StationProperties = {
  id: string;
  name: string;
  group: MapTechnologyGroupId;
  shape: MapShape;
  mw: number | null;
  radius: number;
  color: string;
};

export type StationFeatureCollection = {
  type: "FeatureCollection";
  generated_at?: string;
  features: StationFeature[];
};

export type StationFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: StationProperties;
};

export function stationsFromPoints(points: readonly MapPoint[], now = new Date()): StationFeatureCollection {
  const features: StationFeature[] = [];
  for (const point of points) {
    if (!isCatalogueStation(point.technology)) {
      continue;
    }
    const group = groupForStation(point.technology as Technology);
    const step = sizeStepForMw(point.mw);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
      properties: {
        id: point.id,
        name: point.name,
        group: group.id,
        shape: group.shape,
        mw: point.mw,
        radius: step.radius,
        color: group.color,
      },
    });
  }
  features.sort((left, right) => left.properties.name.localeCompare(right.properties.name));
  return { type: "FeatureCollection", generated_at: now.toISOString(), features };
}
