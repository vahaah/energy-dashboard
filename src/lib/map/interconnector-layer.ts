import { isOrigin } from "@/lib/map/origin";

function isResidualImportsCode(code: string): boolean {
  return code.toUpperCase() === "INTNESO";
}

export type InterconnectorLine = {
  id: string;
  name: string;
  code: string;
  gbLongitude: number;
  gbLatitude: number;
  remoteLongitude: number;
  remoteLatitude: number;
};

export type InterconnectorFeatureCollection = {
  type: "FeatureCollection";
  features: InterconnectorFeature[];
};

export type InterconnectorFeature = {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { id: string; name: string; code: string };
};

export function drawableLine(line: InterconnectorLine): boolean {
  if (isResidualImportsCode(line.code)) {
    return false;
  }
  if (isOrigin(line.gbLongitude, line.gbLatitude) || isOrigin(line.remoteLongitude, line.remoteLatitude)) {
    return false;
  }
  return true;
}

export function interconnectorFeatureCollection(lines: readonly InterconnectorLine[]): InterconnectorFeatureCollection {
  return {
    type: "FeatureCollection",
    features: lines.filter(drawableLine).map((line) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [line.gbLongitude, line.gbLatitude],
          [line.remoteLongitude, line.remoteLatitude],
        ],
      },
      properties: { id: line.id, name: line.name, code: line.code },
    })),
  };
}
