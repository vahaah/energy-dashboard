/**
 * Place names for the overview camera. Zoomstack zooms 0–4 are sea only, so a
 * framed view of Britain never receives a names tile. Country and capital
 * points are copied out of the z5 tiles into GeoJSON that the style can draw
 * below that zoom.
 *
 * Run when the basemap edition changes. It reads the public PMTiles archive
 * already named in data/catalogue/layers.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
import { PMTiles } from "pmtiles";
import { PbfReader } from "pbf";

const ZOOM = 5;
const EXTENT = {
  west: -11.865234375,
  south: 49.38237278700956,
  east: 3.603515625,
  north: 61.56457388515458,
};
const KEEP = new Set(["Country", "Capital"]);

type NamePoint = { name: string; type: string; lon: number; lat: number };

function tileRange(z: number): { x0: number; x1: number; y0: number; y1: number } {
  const n = 2 ** z;
  const xOf = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const yOf = (lat: number) => {
    const radians = (lat * Math.PI) / 180;
    const mercator = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
    return Math.floor(((1 - mercator / Math.PI) / 2) * n);
  };
  return {
    x0: xOf(EXTENT.west),
    x1: xOf(EXTENT.east),
    y0: yOf(EXTENT.north),
    y1: yOf(EXTENT.south),
  };
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

async function main(): Promise<void> {
  const layers = JSON.parse(readFileSync(resolve(process.cwd(), "data/catalogue/layers.json"), "utf8")) as {
    id: string;
    url: string | null;
  }[];
  const url = layers.find((layer) => layer.id === "basemap")?.url;
  if (!url) {
    throw new Error("basemap archive URL is missing");
  }
  const archive = new PMTiles(url);
  const range = tileRange(ZOOM);
  const points = new Map<string, NamePoint>();
  for (let x = range.x0; x <= range.x1; x += 1) {
    for (let y = range.y0; y <= range.y1; y += 1) {
      const tile = await archive.getZxy(ZOOM, x, y);
      if (!tile) {
        continue;
      }
      const parsed = new VectorTile(new PbfReader(tile.data));
      const names = parsed.layers.names;
      if (!names) {
        continue;
      }
      for (let index = 0; index < names.length; index += 1) {
        const feature = names.feature(index);
        const type = String(feature.properties.type ?? "");
        const name = String(feature.properties.name1 ?? "");
        if (!KEEP.has(type) || name.length === 0) {
          continue;
        }
        const geometry = feature.toGeoJSON(x, y, ZOOM).geometry;
        if (geometry.type !== "Point") {
          continue;
        }
        const lon = geometry.coordinates[0];
        const lat = geometry.coordinates[1];
        if (typeof lon !== "number" || typeof lat !== "number") {
          continue;
        }
        const point = { name, type, lon: round(lon), lat: round(lat) };
        points.set(`${type}:${name}:${point.lon}:${point.lat}`, point);
      }
    }
  }
  const features = [...points.values()]
    .sort((left, right) => left.name.localeCompare(right.name) || left.type.localeCompare(right.type))
    .map((point) => ({
      type: "Feature",
      properties: { type: point.type, name1: point.name },
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
    }));
  const collection = { type: "FeatureCollection", features };
  const path = resolve(process.cwd(), "public/basemap/names.geojson");
  writeFileSync(path, `${JSON.stringify(collection)}\n`);
  const countries = features.filter((feature) => feature.properties.type === "Country").length;
  const capitals = features.length - countries;
  process.stdout.write(`place names ${features.length} countries ${countries} capitals ${capitals}\n`);
}

void main();
