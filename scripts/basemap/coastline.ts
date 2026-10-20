/**
 * Coastline for the basemap stroke. Zoomstack sea polygons are clipped to
 * each vector tile, so a fill outline draws the tile grid and the extract
 * box through the North Sea. This keeps the shore and drops those edges.
 *
 * Run when the basemap edition changes. It reads the public PMTiles archive
 * already named in data/catalogue/layers.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
import { PMTiles } from "pmtiles";
import { PbfReader } from "pbf";

const ZOOM = 6;
const EXTENT = {
  west: -11.865234375,
  south: 49.38237278700956,
  east: 3.603515625,
  north: 61.56457388515458,
};
const CLIP_EPS = 0.05;
/** Zoomstack clips sea rings to a tile plus a small buffer, so the cut sits just off the tile edge. */
const TILE_SLOP = 48 / 4096;

type Point = [number, number];
type Line = Point[];

function tileLat(y: number, n: number): number {
  const mercator = Math.PI * (1 - (2 * y) / n);
  return (180 / Math.PI) * Math.atan(Math.sinh(mercator));
}

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

function onSameEdge(a: number, b: number, edge: number, epsilon: number): boolean {
  return Math.abs(a - edge) <= epsilon && Math.abs(b - edge) <= epsilon;
}

function clipped(a: Point, b: Point, tile: { west: number; south: number; east: number; north: number }): boolean {
  const lonEps = (tile.east - tile.west) * TILE_SLOP;
  const latEps = (tile.north - tile.south) * TILE_SLOP;
  if (onSameEdge(a[0], b[0], tile.west, lonEps) || onSameEdge(a[0], b[0], tile.east, lonEps)) {
    return true;
  }
  if (onSameEdge(a[1], b[1], tile.south, latEps) || onSameEdge(a[1], b[1], tile.north, latEps)) {
    return true;
  }
  if (onSameEdge(a[0], b[0], EXTENT.west, CLIP_EPS) || onSameEdge(a[0], b[0], EXTENT.east, CLIP_EPS)) {
    return true;
  }
  if (onSameEdge(a[1], b[1], EXTENT.south, CLIP_EPS) || onSameEdge(a[1], b[1], EXTENT.north, CLIP_EPS)) {
    return true;
  }
  return false;
}

function key(point: Point): string {
  return `${point[0].toFixed(5)},${point[1].toFixed(5)}`;
}

function stitch(segments: Array<[Point, Point]>): Line[] {
  const unused = new Set(segments.map((_, index) => index));
  const next = new Map<string, number[]>();
  const push = (point: Point, index: number) => {
    const id = key(point);
    const list = next.get(id);
    if (list) {
      list.push(index);
    } else {
      next.set(id, [index]);
    }
  };
  segments.forEach((segment, index) => {
    push(segment[0], index);
    push(segment[1], index);
  });

  const lines: Line[] = [];
  const take = (point: Point): [Point, Point] | null => {
    const list = next.get(key(point));
    if (!list) {
      return null;
    }
    while (list.length > 0) {
      const index = list.pop();
      if (index === undefined || !unused.has(index)) {
        continue;
      }
      unused.delete(index);
      const segment = segments[index];
      if (!segment) {
        continue;
      }
      return segment;
    }
    return null;
  };

  while (unused.size > 0) {
    const start = unused.values().next().value;
    if (start === undefined) {
      break;
    }
    unused.delete(start);
    const first = segments[start];
    if (!first) {
      continue;
    }
    const line: Line = [first[0], first[1]];
    const grow = (end: "start" | "finish") => {
      let point = end === "start" ? line[0] : line[line.length - 1];
      if (!point) {
        return;
      }
      for (;;) {
        const segment = take(point);
        if (!segment) {
          return;
        }
        const forward = key(segment[0]) === key(point);
        const other = forward ? segment[1] : segment[0];
        if (end === "start") {
          line.unshift(other);
        } else {
          line.push(other);
        }
        point = other;
      }
    };
    grow("finish");
    grow("start");
    if (line.length >= 2) {
      lines.push(line);
    }
  }
  return lines;
}

function round(point: Point): Point {
  return [Math.round(point[0] * 1e5) / 1e5, Math.round(point[1] * 1e5) / 1e5];
}

/**
 * Sea rings are clipped to each vector tile and to the extract. Those cuts are
 * axis-aligned and, once stroked, draw a grid across the sea and Scotland.
 * A real shore is not a long run of segments that share one rounded longitude
 * or latitude. 0.4° is about 44 km; the tile cuts are many degrees.
 */
const GRID_RUN_DEGREES = 0.4;

export function dropClipGrid(segments: Array<[Point, Point]>): Array<[Point, Point]> {
  const groups = new Map<string, number>();
  const keys = segments.map((segment) => {
    const [a, b] = segment;
    if (!a || !b) {
      return null;
    }
    const dLon = Math.abs(a[0] - b[0]);
    const dLat = Math.abs(a[1] - b[1]);
    if (dLon === 0 && dLat > 0) {
      const key = `v:${a[0].toFixed(5)}`;
      groups.set(key, (groups.get(key) ?? 0) + dLat);
      return key;
    }
    if (dLat === 0 && dLon > 0) {
      const key = `h:${a[1].toFixed(5)}`;
      groups.set(key, (groups.get(key) ?? 0) + dLon);
      return key;
    }
    return null;
  });
  return segments.filter((segment, index) => {
    const key = keys[index];
    if (!key || !segment) {
      return true;
    }
    return (groups.get(key) ?? 0) <= GRID_RUN_DEGREES;
  });
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
  const n = 2 ** ZOOM;
  const segments: Array<[Point, Point]> = [];
  for (let x = range.x0; x <= range.x1; x += 1) {
    for (let y = range.y0; y <= range.y1; y += 1) {
      const tile = await archive.getZxy(ZOOM, x, y);
      if (!tile) {
        continue;
      }
      const parsed = new VectorTile(new PbfReader(tile.data));
      const sea = parsed.layers.sea;
      if (!sea) {
        continue;
      }
      const bounds = {
        west: (x / n) * 360 - 180,
        east: ((x + 1) / n) * 360 - 180,
        north: tileLat(y, n),
        south: tileLat(y + 1, n),
      };
      for (let index = 0; index < sea.length; index += 1) {
        const feature = sea.feature(index).toGeoJSON(x, y, ZOOM);
        const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates : [];
        for (const polygon of polygons) {
          for (const ring of polygon) {
            for (let cursor = 1; cursor < ring.length; cursor += 1) {
              const start = ring[cursor - 1];
              const end = ring[cursor];
              if (!start || !end || start.length < 2 || end.length < 2) {
                continue;
              }
              const a: Point = [start[0] ?? 0, start[1] ?? 0];
              const b: Point = [end[0] ?? 0, end[1] ?? 0];
              if (clipped(a, b, bounds)) {
                continue;
              }
              segments.push([a, b]);
            }
          }
        }
      }
    }
  }
  const rounded = segments.map((segment): [Point, Point] => [round(segment[0]), round(segment[1])]);
  const lines = stitch(dropClipGrid(rounded)).filter((line) => line.length >= 2);
  const collection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { source: "os-open-zoomstack", zoom: ZOOM },
        geometry: { type: "MultiLineString", coordinates: lines },
      },
    ],
  };
  const path = resolve(process.cwd(), "public/basemap/coastline.geojson");
  writeFileSync(path, `${JSON.stringify(collection)}\n`);
  process.stdout.write(`coastline lines ${lines.length} bytes ${Buffer.byteLength(JSON.stringify(collection))}\n`);
}

void main();
