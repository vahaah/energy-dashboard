import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PMTILES_WORLD_BOUNDS,
  archiveEdition,
  assertReusedArchiveEdition,
  editionFromDownloadUrl,
  ensureMbtilesBounds,
  readArchiveEdition,
  tileGridBounds,
} from "@/lib/map/basemap-archive";

const dirs: string[] = [];

function archive(sql: string): string {
  const dir = mkdtempSync(join(tmpdir(), "basemap-archive-"));
  dirs.push(dir);
  const file = join(dir, "zoom.mbtiles");
  execFileSync("sqlite3", [
    file,
    `CREATE TABLE metadata (name TEXT, value TEXT);
     CREATE UNIQUE INDEX name ON metadata (name);
     CREATE TABLE tiles (
       zoom_level INTEGER,
       tile_column INTEGER,
       tile_row INTEGER,
       tile_data BLOB
     );
     INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (2, 1, 1, X'00');
     ${sql}`,
  ]);
  return file;
}

describe("basemap archive", () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads an edition from metadata and ignores a schema version", () => {
    expect(archiveEdition(new Map([["version", "1.0"]]))).toBeNull();
    expect(archiveEdition(new Map([["version", "2026-06"]]))).toBe("2026-06");
    expect(
      archiveEdition(
        new Map([
          ["edition", "2025-11"],
          ["version", "2026-06"],
        ]),
      ),
    ).toBe("2025-11");
    const download =
      "https://example.blob.core.windows.net/downloads/OpenZoomstack/2026-06/allGB/Vector%20Tiles/OS_Open_Zoomstack.mbtiles?sig=secret";
    expect(editionFromDownloadUrl(download)).toBe("2026-06");
  });

  it("refuses a reused archive whose edition is missing or is not the API edition", () => {
    const missing = archive("INSERT INTO metadata (name, value) VALUES ('version', '1.0');");
    expect(readArchiveEdition(missing)).toBeNull();
    expect(() => assertReusedArchiveEdition(readArchiveEdition(missing), "2026-06")).toThrow(/no edition metadata/);

    const stale = archive("INSERT INTO metadata (name, value) VALUES ('edition', '2025-11');");
    expect(readArchiveEdition(stale)).toBe("2025-11");
    expect(() => assertReusedArchiveEdition(readArchiveEdition(stale), "2026-06")).toThrow(/2025-11/);
    assertReusedArchiveEdition(readArchiveEdition(archive("INSERT INTO metadata (name, value) VALUES ('edition', '2026-06');")), "2026-06");
  });

  it("writes derived bounds before conversion and leaves an existing row alone", () => {
    const file = archive("INSERT INTO metadata (name, value) VALUES ('name', 'OS_Open_Zoomstack');");
    const derived = tileGridBounds(file);
    expect(ensureMbtilesBounds(file)).toEqual(derived);
    const stored = execFileSync("sqlite3", [file, "SELECT value FROM metadata WHERE name = 'bounds';"], {
      encoding: "utf8",
    }).trim();
    expect(stored).toBe(derived.join(","));
    expect(stored).not.toBe(PMTILES_WORLD_BOUNDS);

    const kept = archive("INSERT INTO metadata (name, value) VALUES ('bounds', '-9,50,2,60');");
    expect(ensureMbtilesBounds(kept)).toEqual([-9, 50, 2, 60]);
    expect(
      execFileSync("sqlite3", [kept, "SELECT value FROM metadata WHERE name = 'bounds';"], { encoding: "utf8" }).trim(),
    ).toBe("-9,50,2,60");
  });

  it("checks the reused edition before trim and writes bounds before pmtiles convert", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/build-basemap.ts"), "utf8");
    const main = source.slice(source.indexOf("async function main"));
    const editionAt = main.indexOf("assertReusedArchiveEdition");
    const trimAt = main.indexOf("trimZoomSql");
    const boundsAt = main.indexOf("ensureMbtilesBounds");
    const convertAt = main.indexOf('["convert"');
    expect(editionAt).toBeGreaterThan(-1);
    expect(trimAt).toBeGreaterThan(editionAt);
    expect(boundsAt).toBeGreaterThan(trimAt);
    expect(convertAt).toBeGreaterThan(boundsAt);
  });
});
