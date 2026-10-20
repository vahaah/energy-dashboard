import { TECHNOLOGIES, type Technology } from "@/lib/catalogue/assets/technologies";
import { mapSizeStep, type MarkerShape } from "@/lib/map/marker";
import { groupOfTechnology, isGbNation, todayGroup, type TodayGroupId } from "@/lib/map/today-figures";

export type StationSource = {
  id: string;
  name: string;
  technology: string;
  country: string | null;
  mw: number | null;
  latitude: number | null;
  longitude: number | null;
};

export type StationProperties = {
  id: string;
  name: string;
  group: TodayGroupId;
  shape: MarkerShape;
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

function isPlantTechnology(value: string): value is Technology {
  return (TECHNOLOGIES as readonly string[]).includes(value);
}

/**
 * GB operating stations for the map layer. Northern Ireland, links, and a row
 * with no published megawatts are left out. Groups and radii come from the
 * Today card modules.
 */
export function stationsFromPoints(rows: readonly StationSource[], now = new Date()): StationFeatureCollection {
  const features: StationFeature[] = [];
  for (const row of rows) {
    if (row.latitude === null || row.longitude === null || (row.latitude === 0 && row.longitude === 0)) {
      continue;
    }
    if (!isGbNation(row.country) || !isPlantTechnology(row.technology)) {
      continue;
    }
    const step = mapSizeStep(row.mw);
    const group = todayGroup(groupOfTechnology(row.technology));
    if (!step || !group) {
      continue;
    }
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: {
        id: row.id,
        name: row.name,
        group: group.id,
        shape: group.shape,
        mw: row.mw,
        radius: step.radius,
        color: group.color,
      },
    });
  }
  features.sort((left, right) => left.properties.name.localeCompare(right.properties.name));
  return { type: "FeatureCollection", generated_at: now.toISOString(), features };
}
