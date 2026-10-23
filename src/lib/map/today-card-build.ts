import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { TECHNOLOGIES, type Technology } from "@/lib/catalogue/assets/technologies";
import { layersFileSchema } from "@/lib/catalogue/layers";
import { sourceReleaseSchema, type SourceRelease } from "@/lib/catalogue/schema";
import type { GeoJsonGeometry } from "@/lib/map/geojson";
import { parseFeatureCollection } from "@/lib/map/geojson";
import { mapSizeStep, type MarkerShape } from "@/lib/map/marker";
import {
  padStaticMapBbox,
  renderStaticMap,
  staticMapExtent,
  type LngLat,
  type StaticMapImage,
  type StaticMapPoint,
  type StaticMapTheme,
} from "@/lib/map/static-map";
import {
  TODAY_MAP_CSS_WIDTH,
  TODAY_MAP_DARK_PATH,
  TODAY_MAP_LIGHT_PATH,
  TODAY_MAP_PAD_RATIO,
  TODAY_MAP_PADDING_PX,
  TODAY_MAP_SCALE,
  registerEditionLabel,
  repdQuarterEnd,
  todayMapAlt,
  todayMapReleaseCurrent,
  type TodayMapCardFile,
  type TodayMapStamp,
} from "@/lib/map/today-card";
import {
  buildTodayFigures,
  groupOfTechnology,
  isGbNation,
  isGbOperatingPlant,
  todayGroup,
  type TodayPlant,
  type TodayProject,
} from "@/lib/map/today-figures";
import { todayPipelineFromFigures } from "@/lib/map/today-pipeline";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";
import { loadProjectCatalogue } from "@/lib/projects/load";

type LocatedPlant = TodayPlant & {
  longitude: number | null;
  latitude: number | null;
};

export const TODAY_MAP_THEMES = {
  light: { sea: "#e7eef3", land: "#f7f6f3", coast: "#8e99a3" },
  dark: { sea: "#101820", land: "#1c1e21", coast: "#66717c" },
} as const satisfies Record<"light" | "dark", StaticMapTheme>;

const MANIFEST_PATH = resolve("src/lib/map/today-card.json");
const BATTERIES_PATH = resolve("src/lib/map/today-batteries.json");

type BatteryFile = {
  source_release_id: string;
  sites: {
    ref: string;
    country: string;
    mw: number | null;
    longitude: number;
    latitude: number;
  }[];
};

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
  const plants = readPlants();
  const projects = readProjects();
  const figures = buildTodayFigures(plants, projects);
  const points = mapPoints(plants, readBatteries(stamp.repd_source_release_id));
  const rings = readOutlineRings();
  const coordinates: LngLat[] = [];
  for (const ring of rings) {
    for (const position of ring) {
      coordinates.push(position);
    }
  }
  for (const point of points) {
    coordinates.push([point.longitude, point.latitude]);
  }
  const bbox = padStaticMapBbox(staticMapExtent(coordinates), TODAY_MAP_PAD_RATIO);
  const width = TODAY_MAP_CSS_WIDTH * TODAY_MAP_SCALE;
  const height = heightForWidth(bbox, width);
  const shared = {
    bbox,
    points,
    width,
    height,
    rings,
    padding: TODAY_MAP_PADDING_PX,
  };
  const repdEdition = releaseEdition(stamp.repd_source_release_id);
  const dukesEdition = releaseEdition(stamp.dukes_source_release_id);
  const edition = registerEditionLabel(repdEdition, dukesEdition);
  const manifest: TodayMapCardFile = {
    ...stamp,
    edition,
    repd_quarter_end: repdQuarterEnd(repdEdition),
    dukes_published_on: releasePublishedOn(stamp.dukes_source_release_id),
    width,
    height,
    light: TODAY_MAP_LIGHT_PATH,
    dark: TODAY_MAP_DARK_PATH,
    alt:
      figures.operating.sites !== null && figures.operating.gw !== null
        ? todayMapAlt(figures.operating.sites, figures.operating.gw, figures.largestLabels)
        : "Map of Great Britain. Operating power sites are not available for this edition.",
    availability: figures.availability,
    operating: figures.operating,
    technologies: figures.technologies,
    nations: figures.nations,
    pipeline: todayPipelineFromFigures(loadPipelineCatalogue().figures),
  };
  return {
    manifest,
    light: renderStaticMap({ ...shared, theme: TODAY_MAP_THEMES.light }),
    dark: renderStaticMap({ ...shared, theme: TODAY_MAP_THEMES.dark }),
  };
}

function heightForWidth(bbox: readonly [number, number, number, number], width: number): number {
  const [west, south, east, north] = bbox;
  const midLatitude = ((south + north) / 2) * (Math.PI / 180);
  const worldWidth = (east - west) * Math.cos(midLatitude);
  const worldHeight = north - south;
  return Math.max(1, Math.round((width * worldHeight) / worldWidth));
}

function readPlants(): LocatedPlant[] {
  return loadAssetCatalogue().rows.map((row) => ({
    technology: row.technology,
    country: row.country,
    mw: row.mw,
    longitude: row.longitude,
    latitude: row.latitude,
  }));
}

function readProjects(): TodayProject[] {
  return loadProjectCatalogue().projects.map((project) => ({
    technology: project.technology,
    country: project.country,
    displayStage: project.display_stage,
    operationalStatus: project.operational_status,
    powerMw: project.power_mw,
    sources: project.members.map((member) => member.source_id),
  }));
}

function mapPoints(plants: readonly LocatedPlant[], batteries: BatteryFile): StaticMapPoint[] {
  const points: StaticMapPoint[] = [];
  for (const plant of plants) {
    if (!isGbOperatingPlant(plant) || !isTechnology(plant.technology)) {
      continue;
    }
    if (plant.longitude === null || plant.latitude === null) {
      continue;
    }
    const group = todayGroup(groupOfTechnology(plant.technology));
    if (!group) {
      continue;
    }
    const point = marker(plant.longitude, plant.latitude, group.color, group.shape, plant.mw);
    if (point) {
      points.push(point);
    }
  }
  for (const site of batteries.sites) {
    if (!isGbNation(site.country)) {
      continue;
    }
    const group = todayGroup("battery");
    if (!group) {
      continue;
    }
    const point = marker(site.longitude, site.latitude, group.color, group.shape, site.mw);
    if (point) {
      points.push(point);
    }
  }
  return points;
}

function marker(
  longitude: number,
  latitude: number,
  color: string,
  shape: MarkerShape,
  mw: number | null,
): StaticMapPoint | null {
  const step = mapSizeStep(mw);
  if (!step) {
    return null;
  }
  return {
    longitude,
    latitude,
    color,
    shape,
    filled: true,
    radius: step.radius,
  };
}

function isTechnology(value: string): value is Technology {
  return (TECHNOLOGIES as readonly string[]).includes(value);
}

export function assertBatteryRelease(pinsReleaseId: string, registerReleaseId: string): void {
  if (pinsReleaseId !== registerReleaseId) {
    throw new Error(`today battery pins are ${pinsReleaseId}; the plant register is ${registerReleaseId}`);
  }
}

function readBatteries(registerReleaseId: string): BatteryFile {
  const parsed = JSON.parse(readFileSync(BATTERIES_PATH, "utf8")) as BatteryFile;
  if (typeof parsed.source_release_id !== "string" || !Array.isArray(parsed.sites)) {
    throw new Error("today battery file has no sites");
  }
  assertBatteryRelease(parsed.source_release_id, registerReleaseId);
  return parsed;
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
  const batteries = readFileSync(BATTERIES_PATH);
  const projects = readFileSync(resolve("data/catalogue/energy_projects.ndjson"));
  return {
    repd_source_release_id: summary.repd_source_release_id,
    dukes_source_release_id: summary.dukes_source_release_id,
    dno_sha256: dno.sha256,
    batteries_sha256: `sha256:${createHash("sha256").update(batteries).digest("hex")}`,
    projects_sha256: `sha256:${createHash("sha256").update(projects).digest("hex")}`,
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
  return editionOf(readRelease(sourceReleaseId));
}

function releasePublishedOn(sourceReleaseId: string): string | null {
  const publishedAt = readRelease(sourceReleaseId).published_at;
  return publishedAt === null ? null : publishedAt.slice(0, 10);
}

function readRelease(sourceReleaseId: string): SourceRelease {
  const text = readFileSync(resolve("data/catalogue/source_releases.ndjson"), "utf8");
  for (const line of text.split("\n")) {
    if (line.trim().length === 0 || !line.includes(sourceReleaseId)) {
      continue;
    }
    const release = sourceReleaseSchema.parse(JSON.parse(line)) as SourceRelease;
    if (release.source_release_id !== sourceReleaseId) {
      continue;
    }
    return release;
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
