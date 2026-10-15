import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAssetDirectory, mapPoints, type BuiltDirectory } from "@/lib/assets/build";
import type { MapLayerView, MapPoint } from "@/lib/assets/types";
import { parseNdjson } from "@/lib/catalogue/load";
import { layersFileSchema, type MapLayer } from "@/lib/catalogue/layers";
import { sourceReleaseSchema, type SourceRelease } from "@/lib/catalogue/schema";
import { PARTY_FILE, partyRecordSchema, type PartyRecord } from "@/lib/catalogue/assets/parties";
import {
  assetRecordSchema,
  capacityRecordSchema,
  matchRecordSchema,
  projectRecordSchema,
} from "@/lib/catalogue/assets/record-schema";
import type { AssetRecord, CapacityRecord, MatchRecord, ProjectRecord } from "@/lib/catalogue/assets/types";
import { parseFeatureCollection } from "@/lib/map/geojson";

export type AssetCatalogue = BuiltDirectory & {
  points: MapPoint[];
  basemap: MapLayerView;
  dno: MapLayerView;
  regions: string[];
};

function readLines<T>(file: string, text: string, parse: (value: unknown) => T): T[] {
  const parsed = parseNdjson(text, file);
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("\n"));
  }
  return parsed.data.map((value) => parse(value));
}

function layerView(layer: MapLayer): MapLayerView {
  const url = new URL(layer.url);
  return {
    id: layer.id,
    attribution: layer.attribution,
    accuracyWarning: layer.accuracy_warning,
    precision: layer.precision,
    defaultVisible: layer.default_visible,
    path: url.pathname,
    licence: layer.licence,
    licenceUrl: layer.licence_url,
  };
}

export function readAssetCatalogue(root: string): AssetCatalogue {
  const catalogue = join(root, "data", "catalogue");
  const assets = readLines<AssetRecord>(
    "assets.ndjson",
    readFileSync(join(catalogue, "assets.ndjson"), "utf8"),
    (value) => assetRecordSchema.parse(value),
  );
  const projects = readLines<ProjectRecord>(
    "projects.ndjson",
    readFileSync(join(catalogue, "projects.ndjson"), "utf8"),
    (value) => projectRecordSchema.parse(value),
  );
  const capacity = readLines<CapacityRecord>(
    "capacity_records.ndjson",
    readFileSync(join(catalogue, "capacity_records.ndjson"), "utf8"),
    (value) => capacityRecordSchema.parse(value),
  );
  const matches = readLines<MatchRecord>(
    "asset_matches.ndjson",
    readFileSync(join(catalogue, "asset_matches.ndjson"), "utf8"),
    (value) => matchRecordSchema.parse(value),
  );
  const parties = readLines<PartyRecord>(
    PARTY_FILE,
    readFileSync(join(catalogue, PARTY_FILE), "utf8"),
    (value) => partyRecordSchema.parse(value),
  );
  const releases = readLines<SourceRelease>(
    "source_releases.ndjson",
    readFileSync(join(catalogue, "source_releases.ndjson"), "utf8"),
    (value) => sourceReleaseSchema.parse(value),
  );
  const layers = layersFileSchema.parse(JSON.parse(readFileSync(join(catalogue, "layers.json"), "utf8")));
  const basemap = layers.find((layer) => layer.id === "basemap");
  const dno = layers.find((layer) => layer.id === "dno");
  if (!basemap || !dno) {
    throw new Error("map catalogue is missing the basemap or DNO layer");
  }
  const dnoPath = new URL(dno.url).pathname.replace(/^\//, "");
  const collection = parseFeatureCollection(JSON.parse(readFileSync(join(root, "public", dnoPath), "utf8")));
  const built = buildAssetDirectory({
    assets,
    projects,
    capacity,
    matches,
    parties,
    releases,
    dnoFeatures: collection.features,
  });
  const regions = [...new Set(built.rows.map((row) => row.region))].sort((left, right) => left.localeCompare(right, "en"));
  return {
    ...built,
    points: mapPoints(built.rows),
    basemap: layerView(basemap),
    dno: layerView(dno),
    regions,
  };
}

let cached: AssetCatalogue | undefined;

export function loadAssetCatalogue(): AssetCatalogue {
  if (!cached) {
    cached = readAssetCatalogue(process.cwd());
  }
  return cached;
}
