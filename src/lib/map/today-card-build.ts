import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { technologyColor } from "@/lib/assets/labels";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { isCatalogueStation } from "@/lib/assets/types";
import { layersFileSchema } from "@/lib/catalogue/layers";
import { sourceReleaseSchema, type SourceRelease } from "@/lib/catalogue/schema";
import type { GeoJsonGeometry } from "@/lib/map/geojson";
import { parseFeatureCollection } from "@/lib/map/geojson";
import {
  padStaticMapBbox,
  renderStaticMap,
  staticMapDimensions,
  staticMapExtent,
  type LngLat,
  type StaticMapImage,
  type StaticMapTheme,
} from "@/lib/map/static-map";
import {
  TODAY_MAP_DARK_PATH,
  TODAY_MAP_HEIGHT,
  TODAY_MAP_LIGHT_PATH,
  TODAY_MAP_PAD_RATIO,
  TODAY_MAP_PADDING_PX,
  registerEditionLabel,
  todayMapAlt,
  todayMapPointRadius,
  todayMapReleaseCurrent,
  type TodayMapCardFile,
  type TodayMapStamp,
} from "@/lib/map/today-card";

export const TODAY_MAP_THEMES = {
  light: { sea: "#e7eef3", land: "#f7f6f3", coast: "#8e99a3" },
  dark: { sea: "#101820", land: "#1c1e21", coast: "#66717c" },
} as const satisfies Record<"light" | "dark", StaticMapTheme>;

const MANIFEST_PATH = resolve("src/lib/map/today-card.json");

export function todayMapOutputsCurrent(): boolean {
  if (!existsSync(MANIFEST_PATH)) {
    return false;
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as TodayMapCardFile;
  if (!todayMapReleaseCurrent(manifest, readTodayMapStamp())) {
    return false;
  }
  return existsSync(resolve(`public${manifest.light}`)) && existsSync(resolve(`public${manifest.dark}`));
}

export function renderTodayMapCard(): { manifest: TodayMapCardFile; light: StaticMapImage; dark: StaticMapImage } {
  const stamp = readTodayMapStamp();
  const catalogue = loadAssetCatalogue();
  const stations = catalogue.rows.filter((row) => isCatalogueStation(row.technology));
  const stationIds = new Set(stations.map((row) => row.id));
  const rings = readOutlineRings();
  const coordinates: LngLat[] = [];
  for (const ring of rings) {
    for (const position of ring) {
      coordinates.push(position);
    }
  }
  for (const point of catalogue.points) {
    if (!stationIds.has(point.id)) {
      continue;
    }
    coordinates.push([point.longitude, point.latitude]);
  }
  const bbox = padStaticMapBbox(staticMapExtent(coordinates), TODAY_MAP_PAD_RATIO);
  const { width, height } = staticMapDimensions(bbox, TODAY_MAP_HEIGHT);
  const points = catalogue.points.filter((point) => stationIds.has(point.id)).map((point) => ({
    longitude: point.longitude,
    latitude: point.latitude,
    color: technologyColor(point.technology),
    radius: todayMapPointRadius(point.mw),
  }));
  const shared = {
    bbox,
    points,
    width,
    height,
    rings,
    padding: TODAY_MAP_PADDING_PX,
  };
  const edition = registerEditionLabel(releaseEdition(stamp.repd_source_release_id), releaseEdition(stamp.dukes_source_release_id));
  const manifest: TodayMapCardFile = {
    ...stamp,
    edition,
    count: stations.length,
    width,
    height,
    light: TODAY_MAP_LIGHT_PATH,
    dark: TODAY_MAP_DARK_PATH,
    alt: todayMapAlt(stations.length),
  };
  return {
    manifest,
    light: renderStaticMap({ ...shared, theme: TODAY_MAP_THEMES.light }),
    dark: renderStaticMap({ ...shared, theme: TODAY_MAP_THEMES.dark }),
  };
}

function readTodayMapStamp(): TodayMapStamp {
  const summary = JSON.parse(readFileSync(resolve("data/catalogue/asset_summary.json"), "utf8")) as {
    repd_source_release_id?: unknown;
    dukes_source_release_id?: unknown;
  };
  if (typeof summary.repd_source_release_id !== "string" || typeof summary.dukes_source_release_id !== "string") {
    throw new Error("asset summary is missing the register release ids");
  }
  const layers = layersFileSchema.parse(JSON.parse(readFileSync(resolve("data/catalogue/layers.json"), "utf8")));
  const dno = layers.find((layer) => layer.id === "dno");
  if (!dno) {
    throw new Error("map catalogue is missing the DNO layer");
  }
  return {
    repd_source_release_id: summary.repd_source_release_id,
    dukes_source_release_id: summary.dukes_source_release_id,
    dno_sha256: dno.sha256,
  };
}

function readOutlineRings(): LngLat[][] {
  const layers = layersFileSchema.parse(JSON.parse(readFileSync(resolve("data/catalogue/layers.json"), "utf8")));
  const dno = layers.find((layer) => layer.id === "dno");
  if (!dno) {
    throw new Error("map catalogue is missing the DNO layer");
  }
  const path = new URL(dno.url).pathname;
  const collection = parseFeatureCollection(JSON.parse(readFileSync(resolve(`public${path}`), "utf8")));
  const rings: LngLat[][] = [];
  for (const feature of collection.features) {
    rings.push(...geometryRings(feature.geometry));
  }
  return rings;
}

function geometryRings(geometry: GeoJsonGeometry): LngLat[][] {
  switch (geometry.type) {
    case "Polygon":
      return geometry.coordinates.map(toLngLatRing);
    case "MultiPolygon":
      return geometry.coordinates.flatMap((polygon) => polygon.map(toLngLatRing));
    default: {
      const neverGeometry: never = geometry;
      throw new Error(`unsupported geometry ${neverGeometry}`);
    }
  }
}

function toLngLatRing(ring: readonly (readonly [number, number])[]): LngLat[] {
  return ring.map((position) => [position[0], position[1]]);
}

function releaseEdition(sourceReleaseId: string): string {
  const text = readFileSync(resolve("data/catalogue/source_releases.ndjson"), "utf8");
  for (const line of text.split("\n")) {
    if (line.trim().length === 0 || !line.includes(sourceReleaseId)) {
      continue;
    }
    const release = sourceReleaseSchema.parse(JSON.parse(line)) as SourceRelease;
    if (release.source_release_id !== sourceReleaseId) {
      continue;
    }
    return editionOf(release);
  }
  throw new Error(`missing release ${sourceReleaseId}`);
}

function editionOf(release: SourceRelease): string {
  const content = release.content;
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    throw new Error(`release ${release.source_release_id} has no edition`);
  }
  const edition = "edition" in content ? content.edition : undefined;
  if (typeof edition !== "string" || edition.trim().length === 0) {
    throw new Error(`release ${release.source_release_id} has no edition`);
  }
  return edition;
}
