/**
 * Build the checked-in REPD / DUKES asset register and append immutable releases.
 *
 *   npx tsx scripts/catalogue/build-assets.ts
 *   npx tsx scripts/catalogue/build-assets.ts --offline
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { buildAssetRegister, withHistoricalCapacity, type PreviousRegister } from "../../src/lib/catalogue/assets/build";
import {
  assetRecordSchema,
  capacityRecordSchema,
  mappingRecordSchema,
  matchOverridesSchema,
  projectRecordSchema,
} from "../../src/lib/catalogue/assets/record-schema";
import { ingestionRunLine } from "../../src/lib/catalogue/assets/runs";
import { summarizeRegister } from "../../src/lib/catalogue/assets/summary";
import { familyOf, DUKES_DATASET_ID, REPD_DATASET_ID } from "../../src/lib/catalogue/assets/technologies";
import type { CatalogueStation } from "../../src/lib/catalogue/assets/types";
import { sha256Bytes, sha256Prefixed } from "../../src/lib/catalogue/canonical";
import { catalogueReleaseId, CATALOGUE_SCHEMA_VERSION, ASSET_REGISTER_FILES } from "../../src/lib/catalogue/schema";
import { loadDukes } from "./dukes";
import { loadRepd } from "./repd";

const root = resolve(process.cwd(), "data/catalogue");

function ndjson(rows: readonly object[]): string {
  if (rows.length === 0) {
    return "";
  }
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function upsertLine(file: string, idKey: string, id: string, line: string): void {
  const path = resolve(root, file);
  const existing = readFileSync(path, "utf8");
  const lines = existing.split("\n").filter((row) => row.trim().length > 0);
  const index = lines.findIndex((row) => {
    const parsed = JSON.parse(row) as Record<string, unknown>;
    return parsed[idKey] === id;
  });
  if (index >= 0) {
    if (lines[index] !== line) {
      throw new Error(`${id} is already in ${file} with different bytes`);
    }
    return;
  }
  lines.push(line);
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function releaseLine(
  datasetId: string,
  publishedAt: string,
  content: object,
): { id: string; line: string } {
  const contentHash = sha256Prefixed(content);
  const id = catalogueReleaseId(datasetId, publishedAt, contentHash);
  const record = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    source_release_id: id,
    dataset_id: datasetId,
    published_at: publishedAt,
    content_hash: contentHash,
    content,
  };
  return { id, line: JSON.stringify(record) };
}

function readRecords<T>(file: string, schema: z.ZodType<T>): T[] {
  const path = resolve(root, file);
  if (!existsSync(path)) {
    return [];
  }
  const records: T[] = [];
  const lines = readFileSync(path, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      continue;
    }
    const parsed = schema.safeParse(JSON.parse(line));
    if (!parsed.success) {
      throw new Error(`${file}:${index + 1} is not a ${file} record`);
    }
    records.push(parsed.data);
  }
  return records;
}

function previousRegister(): PreviousRegister {
  return {
    assets: readRecords(ASSET_REGISTER_FILES.assets, assetRecordSchema),
    projects: readRecords(ASSET_REGISTER_FILES.projects, projectRecordSchema),
    mappings: readRecords(ASSET_REGISTER_FILES.mappings, mappingRecordSchema),
    capacity: readRecords(ASSET_REGISTER_FILES.capacity, capacityRecordSchema),
  };
}

function appendLine(file: string, idKey: string, id: string, line: string): void {
  const path = resolve(root, file);
  const existing = readFileSync(path, "utf8");
  const lines = existing.split("\n").filter((row) => row.trim().length > 0);
  const index = lines.findIndex((row) => {
    const parsed = JSON.parse(row) as Record<string, unknown>;
    return parsed[idKey] === id;
  });
  if (index >= 0) {
    throw new Error(`${id} is already in ${file}`);
  }
  lines.push(line);
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function unmatchedRenewables(stations: readonly CatalogueStation[], codes: ReadonlySet<string>): CatalogueStation[] {
  return stations
    .filter((station) => !codes.has(station.externalRef) && (station.mw ?? 0) >= 40)
    .filter((station) => {
      const family = familyOf(station.technology);
      return family !== "gas" && family !== "oil" && family !== "nuclear";
    })
    .sort((left, right) => (right.mw ?? 0) - (left.mw ?? 0));
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const offline = process.argv.includes("--offline");
  const repd = await loadRepd(offline);
  const dukes = await loadDukes(offline);
  const overridesPath = resolve(root, ASSET_REGISTER_FILES.overrides);
  const overrides = matchOverridesSchema.parse(JSON.parse(readFileSync(overridesPath, "utf8")));
  const repdContent = {
    edition: repd.edition,
    published_at: repd.publishedAt,
    download_url: repd.downloadUrl,
    extract_sha256: sha256Bytes(repd.bytes),
    bytes: repd.bytes.length,
  };
  const dukesContent = {
    edition: dukes.edition,
    published_at: dukes.publishedAt,
    download_url: dukes.downloadUrl,
    extract_sha256: sha256Bytes(dukes.bytes),
    bytes: dukes.bytes.length,
    headline_mw: dukes.headline,
  };
  const repdRelease = releaseLine(REPD_DATASET_ID, repd.publishedAt, repdContent);
  const dukesRelease = releaseLine(DUKES_DATASET_ID, dukes.publishedAt, dukesContent);
  const register = withHistoricalCapacity(
    buildAssetRegister(repd.stations, dukes.stations, overrides, {
      repd: repdRelease.id,
      dukes: dukesRelease.id,
    }),
    previousRegister(),
    [repdRelease.id, dukesRelease.id],
  );
  const files = {
    assets: ndjson(register.assets),
    projects: ndjson(register.projects),
    capacity: ndjson(register.capacity),
    mappings: ndjson(register.mappings),
    matches: ndjson(register.matches),
  } as const;
  writeFileSync(resolve(root, ASSET_REGISTER_FILES.assets), files.assets);
  writeFileSync(resolve(root, ASSET_REGISTER_FILES.projects), files.projects);
  writeFileSync(resolve(root, ASSET_REGISTER_FILES.capacity), files.capacity);
  writeFileSync(resolve(root, ASSET_REGISTER_FILES.mappings), files.mappings);
  writeFileSync(resolve(root, ASSET_REGISTER_FILES.matches), files.matches);
  const sizes: Record<string, number> = {};
  for (const file of Object.values(ASSET_REGISTER_FILES)) {
    if (file === ASSET_REGISTER_FILES.summary) {
      continue;
    }
    sizes[file] = statSync(resolve(root, file)).size;
  }
  const summary = summarizeRegister(
    register,
    { repd: repdRelease.id, dukes: dukesRelease.id },
    dukes.headline,
    sizes,
  );
  writeFileSync(resolve(root, ASSET_REGISTER_FILES.summary), `${JSON.stringify(summary, null, 2)}\n`);
  upsertLine("source_releases.ndjson", "source_release_id", repdRelease.id, repdRelease.line);
  upsertLine("source_releases.ndjson", "source_release_id", dukesRelease.id, dukesRelease.line);
  const finishedAt = new Date().toISOString();
  const repdRun = ingestionRunLine(REPD_DATASET_ID, repdRelease.id, startedAt, finishedAt);
  const dukesRun = ingestionRunLine(DUKES_DATASET_ID, dukesRelease.id, startedAt, finishedAt);
  appendLine("ingestion_runs.ndjson", "ingestion_run_id", repdRun.id, repdRun.line);
  appendLine("ingestion_runs.ndjson", "ingestion_run_id", dukesRun.id, dukesRun.line);
  const matched = new Set(register.matches.flatMap((match) => match.dukes_site_codes));
  const leftover = unmatchedRenewables(dukes.stations, matched);
  console.log(JSON.stringify(summary, null, 2));
  console.log("unmatched DUKES renewables >= 40 MW");
  for (const station of leftover) {
    console.log(`${station.mw}\t${station.technology}\t${station.name}\t${station.externalRef}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
