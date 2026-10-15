import { execFileSync } from "node:child_process";

const EDITION = /^\d{4}-\d{2}$/;
const BOUNDS_VALUE = /^-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?){3}$/;

/** go-pmtiles v1.31.2 writes these bounds when the MBTiles metadata has none. */
export const PMTILES_WORLD_BOUNDS = "-180,-85,180,85";

export function editionFromDownloadUrl(url: string): string | null {
  const match = /\/OpenZoomstack\/(\d{4}-\d{2})\//.exec(url);
  return match?.[1] ?? null;
}

/** `edition`, or `version` when that value is already `YYYY-MM`. A schema version such as `1.0` is not an edition. */
export function archiveEdition(metadata: ReadonlyMap<string, string>): string | null {
  for (const key of ["edition", "version"]) {
    const value = metadata.get(key)?.trim() ?? "";
    if (EDITION.test(value)) {
      return value;
    }
  }
  return null;
}

export function assertReusedArchiveEdition(found: string | null, apiEdition: string): void {
  if (found === null) {
    throw new Error(
      `reused MBTiles has no edition metadata. Refusing to publish it as OS Open Zoomstack ${apiEdition}.`,
    );
  }
  if (found !== apiEdition) {
    throw new Error(`reused MBTiles edition ${found} does not match the OS product edition ${apiEdition}`);
  }
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function metadataValue(file: string, name: "edition" | "version" | "bounds"): string | null {
  const output = execFileSync("sqlite3", [file, `SELECT value FROM metadata WHERE name = ${sqlString(name)};`], {
    encoding: "utf8",
  }).trim();
  return output.length > 0 ? output : null;
}

export function readArchiveEdition(file: string): string | null {
  const metadata = new Map<string, string>();
  const edition = metadataValue(file, "edition");
  const version = metadataValue(file, "version");
  if (edition !== null) {
    metadata.set("edition", edition);
  }
  if (version !== null) {
    metadata.set("version", version);
  }
  return archiveEdition(metadata);
}

export function stampArchiveEdition(file: string, edition: string): void {
  if (!EDITION.test(edition)) {
    throw new Error(`OS Open Zoomstack edition was ${edition || "missing"}`);
  }
  writeMetadata(file, "edition", edition);
}

function writeMetadata(file: string, name: "edition" | "bounds", value: string): void {
  execFileSync("sqlite3", [
    file,
    `DELETE FROM metadata WHERE name = ${sqlString(name)};
     INSERT INTO metadata (name, value) VALUES (${sqlString(name)}, ${sqlString(value)});`,
  ]);
}

function parseBounds(value: string): [number, number, number, number] | null {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const [west, south, east, north] = parts;
  if (west === undefined || south === undefined || east === undefined || north === undefined) {
    return null;
  }
  if (west >= east || south >= north) {
    return null;
  }
  return [west, south, east, north];
}

export function tileGridBounds(file: string): [number, number, number, number] {
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

/**
 * Read MBTiles bounds, or derive them from the tile grid and store that row
 * before `pmtiles convert`. Without a bounds row the converter publishes the
 * whole world.
 */
export function ensureMbtilesBounds(file: string): [number, number, number, number] {
  const existing = metadataValue(file, "bounds");
  const parsed = existing === null ? null : parseBounds(existing);
  if (parsed) {
    return parsed;
  }
  const derived = tileGridBounds(file);
  const value = derived.join(",");
  if (!BOUNDS_VALUE.test(value)) {
    throw new Error(`refusing to write MBTiles bounds ${value}`);
  }
  writeMetadata(file, "bounds", value);
  return derived;
}
