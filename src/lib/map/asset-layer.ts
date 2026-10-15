import { TECHNOLOGIES } from "@/lib/catalogue/assets/technologies";
import type { AssetTechnology } from "@/lib/assets/types";
import { technologyColor } from "@/lib/assets/labels";
import type { MapPoint } from "@/lib/assets/types";

export type AssetFeatureCollection = {
  type: "FeatureCollection";
  features: AssetFeature[];
};

export type AssetFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string;
    technology: AssetTechnology;
    mw: number | null;
    region: string;
  };
};

export function assetFeatureCollection(points: readonly MapPoint[]): AssetFeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
      properties: {
        id: point.id,
        name: point.name,
        technology: point.technology,
        mw: point.mw,
        region: point.region,
      },
    })),
  };
}

export function technologyColorExpression(): unknown[] {
  const expression: unknown[] = ["match", ["get", "technology"]];
  for (const technology of TECHNOLOGIES) {
    expression.push(technology, technologyColor(technology));
  }
  expression.push("#8c939b");
  return expression;
}

export function capacityRadiusExpression(): unknown[] {
  return ["interpolate", ["linear"], ["sqrt", ["coalesce", ["get", "mw"], 0]], 0, 5, 8, 12, 20, 18, 55, 28];
}
