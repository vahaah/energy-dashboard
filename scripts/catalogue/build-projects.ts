/**
 * Build the checked-in project register from a REPD CSV and a TEC CSV.
 *
 *   npx tsx scripts/catalogue/build-projects.ts --repd data/catalogue/raw/repd.csv --tec data/catalogue/raw/tec.csv
 *
 * The raw extracts stay out of git. Northern Ireland REPD rows are omitted.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { ingestionRunLine } from "../../src/lib/catalogue/assets/runs";
import { sha256Bytes, sha256Prefixed } from "../../src/lib/catalogue/canonical";
import { CATALOGUE_SCHEMA_VERSION, catalogueReleaseId } from "../../src/lib/catalogue/schema";
import { applyProjectMerges, automaticNameLinks, emptyMerges, resolveLinks } from "../../src/lib/projects/merge";
import { diffAgainstPrevious } from "../../src/lib/projects/diff";
import { parseRepdProjects } from "../../src/lib/projects/repd";
import {
  CHANGE_EVENTS_FILE,
  MERGES_FILE,
  PROJECTS_FILE,
  TEC_DATASET_ID,
  TEC_PUBLISHED_AT,
  energyProjectSchema,
  projectMergesSchema,
  type EnergyProject,
  type ProjectMerges,
} from "../../src/lib/projects/schema";
import { parseTecProjects } from "../../src/lib/projects/tec";

const TEC_CSV_URL =
  "https://api.neso.energy/dataset/cbd45e54-e6e2-4a38-99f1-8de6fd96d7c1/resource/17becbab-e3e8-473f-b303-3806f43a6a10/download/tec-register-13-october-2026.csv";

function flag(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a path`);
  }
  return resolve(value);
}

function readMerges(path: string): ProjectMerges {
  if (!existsSync(path)) {
    return emptyMerges();
  }
  return projectMergesSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

function readPreviousProjects(path: string): EnergyProject[] | null {
  if (!existsSync(path)) {
    return null;
  }
  const text = readFileSync(path, "utf8").trim();
  if (text.length === 0) {
    return null;
  }
  return text.split("\n").map((line) => energyProjectSchema.parse(JSON.parse(line)));
}

const startedAt = new Date().toISOString();
const catalogue = resolve("data/catalogue");
const projectsPath = resolve(catalogue, PROJECTS_FILE);
const previous = readPreviousProjects(projectsPath);
const repdPath = flag("--repd");
const tecPath = flag("--tec");
const repd = parseRepdProjects(new TextDecoder("windows-1252").decode(readFileSync(repdPath)));
const tecBytes = readFileSync(tecPath);
const parsedTec = parseTecProjects(tecBytes.toString("utf8"));
if (!parsedTec.ok) {
  throw new Error(parsedTec.reason);
}

const mergesPath = resolve(catalogue, MERGES_FILE);
const existing = readMerges(mergesPath);
const links = resolveLinks(automaticNameLinks(repd, parsedTec.rows), existing);
const merges: ProjectMerges = {
  catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
  links,
  unlinks: existing.unlinks,
};
const projects = applyProjectMerges(repd, parsedTec.rows, merges);
const releaseId = `${TEC_DATASET_ID}:${TEC_PUBLISHED_AT}`;
const events = diffAgainstPrevious(previous, projects, releaseId, startedAt);
writeFileSync(projectsPath, `${projects.map((project) => JSON.stringify(project)).join("\n")}\n`);
writeFileSync(mergesPath, `${JSON.stringify(merges, null, 2)}\n`);
writeFileSync(
  resolve(catalogue, CHANGE_EVENTS_FILE),
  `${JSON.stringify({ catalogue_schema_version: 1, observed_at: startedAt, events }, null, 2)}\n`,
);

const content = {
  edition: "TEC Register 13 October 2026",
  published_at: TEC_PUBLISHED_AT,
  download_url: TEC_CSV_URL,
  extract_sha256: sha256Bytes(tecBytes),
  bytes: tecBytes.byteLength,
  projects: parsedTec.rows.length,
  gate_column_since: "2025-11-21",
};
const contentHash = sha256Prefixed(content);
const sourceReleaseId = catalogueReleaseId(TEC_DATASET_ID, TEC_PUBLISHED_AT, contentHash);
const releaseLine = JSON.stringify({
  catalogue_schema_version: 1,
  source_release_id: sourceReleaseId,
  dataset_id: TEC_DATASET_ID,
  published_at: TEC_PUBLISHED_AT,
  content_hash: contentHash,
  content,
});
const releasesPath = resolve(catalogue, "source_releases.ndjson");
const releases = readFileSync(releasesPath, "utf8");
if (!releases.includes(sourceReleaseId)) {
  appendFileSync(releasesPath, `${releaseLine}\n`);
}
const finishedAt = new Date().toISOString();
const run = ingestionRunLine(TEC_DATASET_ID, sourceReleaseId, startedAt, finishedAt);
appendFileSync(resolve(catalogue, "ingestion_runs.ndjson"), `${run.line}\n`);

console.log(
  `projects ${projects.length} repd ${repd.length} tec ${parsedTec.rows.length} links ${links.length} release ${sourceReleaseId}`,
);
