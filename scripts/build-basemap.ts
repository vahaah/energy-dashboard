#!/usr/bin/env npx tsx
/**
 * Build the OS Open Zoomstack basemap and publish it to Vercel Blob.
 *
 *   BLOB_READ_WRITE_TOKEN=... npx tsx scripts/build-basemap.ts
 *
 * Manual, or twice a year. Not a CI step. Refuses to start when the Blob
 * token is unset, and never prints the token. Needs sqlite3. Downloads the
 * pinned pmtiles CLI when it is not on PATH.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { put } from "@vercel/blob";
import { CATALOGUE_SCHEMA_VERSION } from "../src/lib/catalogue/schema";
import { LAYER_FILES, type MapLayer } from "../src/lib/catalogue/layers";
import { pointZoomstackSource } from "../src/lib/map/basemap-style";
import {
  BASEMAP_LAYER_ID,
  BASEMAP_PRECISION,
  BASEMAP_ZOOM_MAX,
  BASEMAP_ZOOM_MIN,
  OS_LICENCE,
  OS_LICENCE_URL,
  OS_ZOOMSTACK_DOWNLOAD_URL,
  OS_ZOOMSTACK_PRODUCT_URL,
  osBasemapAttribution,
} from "../src/lib/map/constants";

const PMTILES_VERSION = "1.31.2";
const USER_AGENT = "grid-catalogue/1.0 (energy-dashboard; OS Open Zoomstack basemap)";

function redact(message: string): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  let next = message;
  if (token.length > 0) {
    next = next.split(token).join("[redacted]");
  }
  return next;
}

function requireToken(): void {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && token.trim().length > 0) {
    return;
  }
  console.error("BLOB_READ_WRITE_TOKEN is unset. Refusing to download OS Open Zoomstack.");
  console.error("Alex, from the repo root, with the Vercel Blob read-write token in the environment and not echoed:");
  console.error("  npx tsx scripts/build-basemap.ts");
  console.error(
    `The script reads the edition from ${OS_ZOOMSTACK_PRODUCT_URL}, downloads the OGL v3 vector-tile MBTiles, deletes zoom levels above ${BASEMAP_ZOOM_MAX}, converts that archive to one PMTiles file with pmtiles ${PMTILES_VERSION}, and uploads it to tiles/basemap/<edition>.pmtiles.`,
  );
  console.error("It then records bytes and sha256 on the basemap row in data/catalogue/layers.json and points the checked-in styles at that URL.");
  console.error("sqlite3 must be on PATH. The pmtiles CLI is downloaded when it is missing. This does not run in CI.");
  process.exit(2);
}

/**
 * MBTiles can store tiles as a plain table or as a deduplicated map/images
 * pair behind a tiles view. OS Open Zoomstack ships the second, where the
 * view cannot be deleted from.
 */
function mbtilesTilesKind(file: string): "table" | "view" {
  const kind = execFileSync("sqlite3", [file, "SELECT type FROM sqlite_master WHERE name = 'tiles';"], {
    encoding: "utf8",
  }).trim();
  if (kind === "table" || kind === "view") {
    return kind;
  }
  throw new Error(`MBTiles has no tiles table or view (found ${kind || "nothing"})`);
}

function trimZoomSql(kind: "table" | "view", maxZoom: number): string {
  const zoom = Math.trunc(maxZoom);
  const remove =
    kind === "table"
      ? `DELETE FROM tiles WHERE zoom_level > ${zoom};`
      : `DELETE FROM map WHERE zoom_level > ${zoom};
       DELETE FROM images WHERE tile_id NOT IN (SELECT tile_id FROM map);`;
  return `${remove}
       UPDATE metadata SET value = '${zoom}' WHERE name = 'maxzoom';
       VACUUM;`;
}

function pmtilesAsset(): { name: string; url: string } {
  const platform = process.platform;
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  if (platform === "linux") {
    const name = `go-pmtiles_${PMTILES_VERSION}_Linux_${arch}.tar.gz`;
    return { name, url: `https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${name}` };
  }
  if (platform === "darwin") {
    const name = `go-pmtiles-${PMTILES_VERSION}_Darwin_${arch}.zip`;
    return { name, url: `https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${name}` };
  }
  throw new Error(`no pinned pmtiles build for ${platform} ${arch}`);
}

function pmtilesBin(work: string): string {
  try {
    execFileSync("pmtiles", ["version"], { stdio: "ignore" });
    return "pmtiles";
  } catch {
    // download the pinned release below
  }
  const asset = pmtilesAsset();
  const archive = join(work, asset.name);
  execFileSync("curl", ["-fsSL", "-A", USER_AGENT, "-o", archive, asset.url], { stdio: "inherit" });
  if (asset.name.endsWith(".zip")) {
    execFileSync("unzip", ["-o", archive, "-d", work], { stdio: "inherit" });
  } else {
    execFileSync("tar", ["-xzf", archive, "-C", work], { stdio: "inherit" });
  }
  return join(work, "pmtiles");
}

async function downloadTo(url: string, file: string): Promise<void> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`download returned ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
}

function sha256File(file: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolveHash(`sha256:${hash.digest("hex")}`);
    });
  });
}

function mbtilesBounds(file: string): [number, number, number, number] {
  const output = execFileSync("sqlite3", [file, "SELECT value FROM metadata WHERE name = 'bounds';"], {
    encoding: "utf8",
  }).trim();
  const parts = output.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    // OS Open Zoomstack ships no bounds row, so derive them from the tile grid.
    return tileGridBounds(file);
  }
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0];
}

function tileGridBounds(file: string): [number, number, number, number] {
  const output = execFileSync(
    "sqlite3",
    [
      file,
      "SELECT zoom_level, MIN(tile_column), MAX(tile_column), MIN(tile_row), MAX(tile_row) FROM tiles WHERE zoom_level = (SELECT MAX(zoom_level) FROM tiles);",
    ],
    { encoding: "utf8" },
  ).trim();
  const [z, minX, maxX, minRow, maxRow] = output.split("|").map((part) => Number(part));
  if ([z, minX, maxX, minRow, maxRow].some((part) => part === undefined || !Number.isFinite(part))) {
    throw new Error(`MBTiles bounds were missing and the tile grid was ${output || "empty"}`);
  }
  const n = 2 ** (z as number);
  const lon = (x: number) => (x / n) * 360 - 180;
  // MBTiles rows are TMS, counted from the south.
  const lat = (row: number) => {
    const y = n - row;
    return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  };
  const round = (value: number) => Math.round(value * 1e4) / 1e4;
  return [
    round(lon(minX as number)),
    round(lat(minRow as number)),
    round(lon((maxX as number) + 1)),
    round(lat((maxRow as number) + 1)),
  ];
}

function readLayers(dir: string): MapLayer[] {
  try {
    return JSON.parse(readFileSync(join(dir, LAYER_FILES.layers), "utf8")) as MapLayer[];
  } catch {
    return [];
  }
}

function pointStylesAt(blobUrl: string, copyrightYear: number): void {
  for (const name of ["style-light.json", "style-dark.json"]) {
    const path = resolve(process.cwd(), "public/basemap", name);
    const style = JSON.parse(readFileSync(path, "utf8")) as {
      sources?: { zoomstack?: { url?: string; attribution?: string } };
    };
    const source = style.sources?.zoomstack;
    if (!source?.url) {
      throw new Error(`${name} has no zoomstack source`);
    }
    const pointed = pointZoomstackSource(
      { ...source, url: source.url, attribution: source.attribution ?? "" },
      blobUrl,
      copyrightYear,
    );
    source.url = pointed.url;
    source.attribution = pointed.attribution;
    writeFileSync(path, `${JSON.stringify(style, null, 2)}\n`);
  }
}

async function main(): Promise<void> {
  requireToken();
  const work = join(tmpdir(), "grid-basemap");
  mkdirSync(work, { recursive: true });
  const productResponse = await fetch(OS_ZOOMSTACK_PRODUCT_URL, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!productResponse.ok) {
    throw new Error(`OS product API returned ${productResponse.status}`);
  }
  const product = (await productResponse.json()) as { version?: string };
  const edition = product.version ?? "";
  if (!/^\d{4}-\d{2}$/.test(edition)) {
    throw new Error(`OS Open Zoomstack edition was ${edition || "missing"}`);
  }
  const year = Number(edition.slice(0, 4));
  const reuse = process.env.BASEMAP_MBTILES;
  const mbtiles = reuse && reuse.length > 0 ? resolve(reuse) : join(work, "OS_Open_Zoomstack.mbtiles");
  if (reuse && reuse.length > 0) {
    console.log(`reusing ${mbtiles} for OS Open Zoomstack ${edition}`);
  } else {
    console.log(`downloading OS Open Zoomstack ${edition}`);
    await downloadTo(OS_ZOOMSTACK_DOWNLOAD_URL, mbtiles);
  }
  execFileSync("sqlite3", [mbtiles, trimZoomSql(mbtilesTilesKind(mbtiles), BASEMAP_ZOOM_MAX)], { stdio: "inherit" });
  const bin = pmtilesBin(work);
  const pmtiles = join(work, `${edition}.pmtiles`);
  execFileSync(bin, ["convert", mbtiles, pmtiles], { stdio: "inherit" });
  const bytes = statSync(pmtiles).size;
  const sha = await sha256File(pmtiles);
  const bbox = mbtilesBounds(mbtiles);
  const blob = await put(`tiles/basemap/${edition}.pmtiles`, createReadStream(pmtiles), {
    access: "public",
    multipart: true,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.pmtiles",
  });
  const layer: MapLayer = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    id: BASEMAP_LAYER_ID,
    kind: "basemap",
    edition,
    source_crs: "EPSG:3857",
    tolerance: null,
    bbox,
    url: blob.url,
    bytes,
    sha256: sha,
    precision: BASEMAP_PRECISION,
    licence: OS_LICENCE,
    licence_url: OS_LICENCE_URL,
    attribution: osBasemapAttribution(year),
    accuracy_warning: null,
    release_id: `os-open-zoomstack:${edition}`,
    default_visible: true,
    zoom: { min: BASEMAP_ZOOM_MIN, max: BASEMAP_ZOOM_MAX },
  };
  const catalogueDir = resolve(process.cwd(), "data/catalogue");
  const layers = readLayers(catalogueDir).filter((entry) => entry.id !== BASEMAP_LAYER_ID);
  layers.push(layer);
  layers.sort((left, right) => left.id.localeCompare(right.id));
  writeFileSync(join(catalogueDir, LAYER_FILES.layers), `${JSON.stringify(layers, null, 2)}\n`);
  pointStylesAt(blob.url, year);
  console.log(JSON.stringify({ edition, zoom: `${BASEMAP_ZOOM_MIN}-${BASEMAP_ZOOM_MAX}`, bytes, sha256: sha, url: blob.url }, null, 2));
}

main().catch((error: unknown) => {
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
