#!/usr/bin/env npx tsx
/**
 * Fetch the NESO DNO licence-area GeoJSON, transform EPSG:27700 to EPSG:4326,
 * simplify, and write a checked-in GeoJSON when the result is under 1 MB.
 *
 *   npx tsx scripts/build-dno-layer.ts
 *
 * Not a CI step. A failed run leaves the previous catalogue pointer in place.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CATALOGUE_SCHEMA_VERSION } from "../src/lib/catalogue/schema";
import { LAYER_FILES, type MapLayer, type LayerWatchFile } from "../src/lib/catalogue/layers";
import {
  DNO_ATTRIBUTION,
  DNO_LAYER_ID,
  DNO_LICENCE,
  DNO_LICENCE_URL,
  DNO_PRECISION,
  DNO_SAMPLE_POINTS,
  DNO_SIMPLIFY_TOLERANCE_DEGREES,
  NESO_DNO_ACCURACY_WARNING,
  NESO_DNO_PACKAGE_URL,
} from "../src/lib/map/constants";
import { SITE_ORIGIN } from "../src/lib/site";
import { areaAt, publishDnoCollection } from "../src/lib/map/geojson";
import { editionFromResource, selectDnoGeoJsonResource } from "../src/lib/map/layer-watch";

const USER_AGENT = "grid-catalogue/1.0 (energy-dashboard; DNO layer publish)";
const root = resolve(process.cwd(), "data/catalogue");

type Download = {
  sourceUrl: string;
  edition: string;
  etag: string | null;
  sha256: string;
  bytes: Buffer;
};

function sha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function readBody(response: Response): Promise<{ etag: string | null; bytes: Buffer }> {
  if (!response.ok) {
    throw new Error(`NESO source returned ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { etag: response.headers.get("etag"), bytes };
}

async function download(): Promise<Download> {
  const packageResponse = await fetch(NESO_DNO_PACKAGE_URL, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!packageResponse.ok) {
    throw new Error(`NESO package returned ${packageResponse.status}`);
  }
  const payload = (await packageResponse.json()) as { result?: { resources?: unknown[] } };
  const resources = payload.result?.resources ?? [];
  const resource = selectDnoGeoJsonResource(resources);
  const sourceUrl = resource.url ?? "";
  const edition = editionFromResource(resource);
  const first = await fetch(sourceUrl, {
    redirect: "manual",
    headers: { "user-agent": USER_AGENT },
  });
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("location");
    if (!location || !location.startsWith("https://")) {
      throw new Error("NESO download redirect was not https");
    }
    const file = await fetch(location, { redirect: "error", headers: { "user-agent": USER_AGENT } });
    const body = await readBody(file);
    return { sourceUrl, edition, etag: body.etag, sha256: sha256(body.bytes), bytes: body.bytes };
  }
  const body = await readBody(first);
  return { sourceUrl, edition, etag: body.etag, sha256: sha256(body.bytes), bytes: body.bytes };
}

function readWatch(): LayerWatchFile {
  try {
    return JSON.parse(readFileSync(join(root, LAYER_FILES.watch), "utf8")) as LayerWatchFile;
  } catch {
    return { catalogue_schema_version: CATALOGUE_SCHEMA_VERSION, layers: [] };
  }
}

function readLayers(): MapLayer[] {
  try {
    return JSON.parse(readFileSync(join(root, LAYER_FILES.layers), "utf8")) as MapLayer[];
  } catch {
    return [];
  }
}

function upsert(layers: MapLayer[], layer: MapLayer): MapLayer[] {
  const rest = layers.filter((entry) => entry.id !== layer.id);
  return [...rest, layer].sort((left, right) => left.id.localeCompare(right.id));
}

async function main(): Promise<void> {
  const downloaded = await download();
  const published = publishDnoCollection(JSON.parse(downloaded.bytes.toString("utf8")), DNO_SIMPLIFY_TOLERANCE_DEGREES);
  if (published.sourceCrs !== "EPSG:27700") {
    throw new Error(`expected EPSG:27700, detected ${published.sourceCrs}`);
  }
  for (const point of DNO_SAMPLE_POINTS) {
    const area = areaAt(published.collection.features, point.longitude, point.latitude);
    if (area !== point.area) {
      throw new Error(`${point.name} landed in ${area ?? "no polygon"}, expected ${point.area}`);
    }
  }
  if (published.kind !== "geojson") {
    throw new Error(
      `DNO GeoJSON is ${published.bytes} bytes, at or above 1 MB. Raise the stored tolerance or publish PMTiles with BLOB_READ_WRITE_TOKEN. The previous layer was not replaced.`,
    );
  }
  const relative = `tiles/layers/dno/${downloaded.edition}.geojson`;
  const filePath = resolve(process.cwd(), "public", relative);
  mkdirSync(resolve(filePath, ".."), { recursive: true });
  writeFileSync(filePath, published.body);
  const fileSha = sha256(readFileSync(filePath));
  const layer: MapLayer = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    id: DNO_LAYER_ID,
    kind: "geojson",
    edition: downloaded.edition,
    source_crs: published.sourceCrs,
    tolerance: DNO_SIMPLIFY_TOLERANCE_DEGREES,
    bbox: published.bbox,
    url: `${SITE_ORIGIN}/${relative}`,
    bytes: published.bytes,
    sha256: fileSha,
    precision: DNO_PRECISION,
    licence: DNO_LICENCE,
    licence_url: DNO_LICENCE_URL,
    attribution: DNO_ATTRIBUTION,
    accuracy_warning: NESO_DNO_ACCURACY_WARNING,
    release_id: `neso-open-data:gb-dno-licence-areas:${downloaded.edition}`,
    default_visible: false,
    zoom: null,
  };
  const entry = {
    id: DNO_LAYER_ID,
    package_url: NESO_DNO_PACKAGE_URL,
    source_url: downloaded.sourceUrl,
    source_etag: downloaded.etag,
    source_sha256: downloaded.sha256,
    checked_at: new Date().toISOString(),
  };
  const existing = readWatch();
  const watch: LayerWatchFile = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    layers: [...existing.layers.filter((item) => item.id !== DNO_LAYER_ID), entry].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
  writeFileSync(join(root, LAYER_FILES.layers), `${JSON.stringify(upsert(readLayers(), layer), null, 2)}\n`);
  writeFileSync(join(root, LAYER_FILES.watch), `${JSON.stringify(watch, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        edition: downloaded.edition,
        source_crs: published.sourceCrs,
        tolerance: DNO_SIMPLIFY_TOLERANCE_DEGREES,
        bytes: published.bytes,
        sha256: fileSha,
        kind: published.kind,
        url: layer.url,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/https?:\/\/\S*r2\.cloudflarestorage\.com\S*/g, "[signed-url]"));
  process.exit(1);
});
