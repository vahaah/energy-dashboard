import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { z } from "zod";
import {
  LAYER_FILES,
  layerWatchFileSchema,
  layersFileSchema,
  type MapLayer,
} from "@/lib/catalogue/layers";
import {
  BASEMAP_LAYER_ID,
  BASEMAP_PRECISION,
  BASEMAP_ZOOM_MAX,
  BASEMAP_ZOOM_MIN,
  DNO_ATTRIBUTION,
  DNO_LAYER_ID,
  DNO_PRECISION,
  NESO_DNO_ACCURACY_WARNING,
  osBasemapAttribution,
} from "@/lib/map/constants";

const OS_ATTRIBUTION = /^Contains OS data © Crown copyright and database right \d{4}$/;

export type LayerCheckOptions = {
  /** The published catalogue must list the DNO layer. Fixtures may omit the file. */
  required?: boolean;
};

function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${file}: ${path}: ${issue.message}`;
  });
}

function readJson(filePath: string): { ok: true; data: unknown } | { ok: false; errors: string[] } {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return { ok: false, errors: [`missing ${filePath.split("/").pop()}`] };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, errors: [`${filePath.split("/").pop()}: invalid JSON`] };
  }
}

function bboxErrors(layer: MapLayer): string[] {
  if (layer.bbox === null) {
    return [];
  }
  const [west, south, east, north] = layer.bbox;
  if (west >= east || south >= north) {
    return [`${layer.id}: bbox must be [west, south, east, north] with west < east and south < north`];
  }
  return [];
}

function dnoErrors(layer: MapLayer): string[] {
  const errors: string[] = [];
  if (layer.default_visible !== false) {
    errors.push(`${layer.id}: default_visible must be false`);
  }
  if (layer.precision !== DNO_PRECISION) {
    errors.push(`${layer.id}: precision must be ${DNO_PRECISION}`);
  }
  if (layer.source_crs !== "EPSG:27700") {
    errors.push(`${layer.id}: source_crs must be EPSG:27700`);
  }
  if (layer.attribution !== DNO_ATTRIBUTION) {
    errors.push(`${layer.id}: attribution must include the NESO Open Data line and the OGL v3 line`);
  }
  if (layer.accuracy_warning !== NESO_DNO_ACCURACY_WARNING) {
    errors.push(`${layer.id}: accuracy_warning must be NESO's published disclaimer`);
  }
  if (!layer.attribution.includes("Open Government Licence v3.0")) {
    errors.push(`${layer.id}: missing NESO OGL attribution`);
  }
  if (layer.tolerance === null) {
    errors.push(`${layer.id}: tolerance is required`);
  }
  return errors;
}

function basemapErrors(layer: MapLayer): string[] {
  const errors: string[] = [];
  if (layer.kind !== "basemap") {
    errors.push(`${layer.id}: kind must be basemap`);
  }
  if (layer.precision !== BASEMAP_PRECISION) {
    errors.push(`${layer.id}: precision must be ${BASEMAP_PRECISION}`);
  }
  if (!OS_ATTRIBUTION.test(layer.attribution)) {
    errors.push(`${layer.id}: attribution must be the OS Crown copyright line`);
  }
  const year = Number(layer.edition.slice(0, 4));
  if (Number.isInteger(year) && layer.attribution !== osBasemapAttribution(year)) {
    errors.push(`${layer.id}: attribution year must match the edition`);
  }
  if (layer.zoom?.min !== BASEMAP_ZOOM_MIN || layer.zoom?.max !== BASEMAP_ZOOM_MAX) {
    errors.push(`${layer.id}: zoom must be ${BASEMAP_ZOOM_MIN}-${BASEMAP_ZOOM_MAX}`);
  }
  if (layer.default_visible !== true) {
    errors.push(`${layer.id}: default_visible must be true`);
  }
  return errors;
}

function localPublicFile(repoRoot: string, url: string): string | null {
  const prefix = "https://grid.vahaah.com/";
  if (!url.startsWith(prefix)) {
    return null;
  }
  return join(repoRoot, "public", url.slice(prefix.length));
}

function fileErrors(repoRoot: string, layer: MapLayer): string[] {
  const path = localPublicFile(repoRoot, layer.url);
  if (!path) {
    return [];
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    return [`${layer.id}: ${layer.url} is not in public/`];
  }
  const errors: string[] = [];
  if (bytes.byteLength !== layer.bytes) {
    errors.push(`${layer.id}: bytes ${layer.bytes} does not match the file (${bytes.byteLength})`);
  }
  const sha = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (sha !== layer.sha256) {
    errors.push(`${layer.id}: sha256 does not match the file`);
  }
  return errors;
}

export function checkLayerCatalogue(dir: string, options: LayerCheckOptions = {}): string[] {
  const required = options.required ?? false;
  const layersPath = join(dir, LAYER_FILES.layers);
  const watchPath = join(dir, LAYER_FILES.watch);
  const loaded = readJson(layersPath);
  if (!loaded.ok) {
    return required ? loaded.errors : [];
  }
  const parsed = layersFileSchema.safeParse(loaded.data);
  if (!parsed.success) {
    return formatIssues(LAYER_FILES.layers, parsed.error);
  }

  const errors: string[] = [];
  const seen = new Set<string>();
  for (const layer of parsed.data) {
    if (seen.has(layer.id)) {
      errors.push(`duplicate layer id ${layer.id}`);
    }
    seen.add(layer.id);
    errors.push(...bboxErrors(layer));
    if (layer.id === DNO_LAYER_ID) {
      errors.push(...dnoErrors(layer));
    }
    if (layer.id === BASEMAP_LAYER_ID) {
      errors.push(...basemapErrors(layer));
    }
    const kind = layer.kind;
    switch (kind) {
      case "basemap":
      case "geojson":
      case "pmtiles":
        break;
      default: {
        const neverKind: never = kind;
        errors.push(`${layer.id}: unknown kind ${neverKind}`);
      }
    }
  }

  if (required && !seen.has(DNO_LAYER_ID)) {
    errors.push(`missing ${DNO_LAYER_ID} layer`);
  }

  const repoRoot = resolve(dir, "../..");
  for (const layer of parsed.data) {
    errors.push(...fileErrors(repoRoot, layer));
  }

  if (seen.has(DNO_LAYER_ID)) {
    errors.push(...checkWatch(watchPath, parsed.data, required));
  }
  return errors;
}

function checkWatch(watchPath: string, layers: readonly MapLayer[], required: boolean): string[] {
  const loaded = readJson(watchPath);
  if (!loaded.ok) {
    return required ? loaded.errors : [];
  }
  const parsed = layerWatchFileSchema.safeParse(loaded.data);
  if (!parsed.success) {
    return formatIssues(LAYER_FILES.watch, parsed.error);
  }
  const errors: string[] = [];
  const ids = new Set(layers.map((layer) => layer.id));
  const seen = new Set<string>();
  for (const entry of parsed.data.layers) {
    if (seen.has(entry.id)) {
      errors.push(`duplicate layer watch id ${entry.id}`);
    }
    seen.add(entry.id);
    if (!ids.has(entry.id)) {
      errors.push(`layer watch ${entry.id} has no layer`);
    }
  }
  if (required && !seen.has(DNO_LAYER_ID)) {
    errors.push(`missing ${DNO_LAYER_ID} layer watch`);
  }
  return errors;
}
