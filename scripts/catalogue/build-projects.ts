/**
 * Build the checked-in project register from a REPD CSV and a TEC CSV.
 *
 *   npx tsx scripts/catalogue/build-projects.ts --repd data/catalogue/raw/repd.csv --tec data/catalogue/raw/tec.csv
 *
 * The raw extracts stay out of git. Northern Ireland REPD rows are omitted.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256Bytes, sha256Prefixed } from "../../src/lib/catalogue/canonical";
import { CATALOGUE_SCHEMA_VERSION, catalogueReleaseId } from "../../src/lib/catalogue/schema";
import { applyProjectMerges, automaticNameLinks, emptyMerges, resolveLinks } from "../../src/lib/projects/merge";
import { diffProjectSnapshots } from "../../src/lib/projects/diff";
import { parseRepdProjects } from "../../src/lib/projects/repd";
import {
  CHANGE_EVENTS_FILE,
  MERGES_FILE,
  PROJECTS_FILE,
  TEC_DATASET_ID,
  TEC_PUBLISHED_AT,
  projectMergesSchema,
  type EnergyProject,
  type ProjectMerges,
} from "../../src/lib/projects/schema";
import type { ProjectSnapshotRow } from "../../src/lib/projects/diff";
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

function snapshotRow(project: EnergyProject, releaseId: string): ProjectSnapshotRow {
  return {
    entity: project.project_id,
    release_id: releaseId,
    planning_status: project.planning_status,
    planning_decision_date: project.planning_decision_date,
    construction_status: project.construction_status,
    construction_evidence_date: project.construction_evidence_date,
    connection_stage: project.connection_stage,
    connection_gate: project.connection_gate,
    agreement_status: project.agreement_status,
    expected_energisation: project.expected_energisation,
    operational_status: project.operational_status,
    commissioning_date: project.commissioning_date,
    closure_date: project.closure_date,
    power_mw: project.power_mw,
    connection_capacity_mw: project.connection_capacity_mw,
    storage_energy_mwh: project.storage_energy_mwh,
  };
}

function readMerges(path: string): ProjectMerges {
  if (!existsSync(path)) {
    return emptyMerges();
  }
  return projectMergesSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

const catalogue = resolve("data/catalogue");
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
writeFileSync(resolve(catalogue, PROJECTS_FILE), `${projects.map((project) => JSON.stringify(project)).join("\n")}\n`);
writeFileSync(mergesPath, `${JSON.stringify(merges, null, 2)}\n`);

const releaseId = `${TEC_DATASET_ID}:${TEC_PUBLISHED_AT}`;
const events = diffProjectSnapshots(
  projects.map((project) => snapshotRow(project, releaseId)),
  projects.map((project) => snapshotRow(project, releaseId)),
  TEC_PUBLISHED_AT,
);
writeFileSync(
  resolve(catalogue, CHANGE_EVENTS_FILE),
  `${JSON.stringify({ catalogue_schema_version: 1, observed_at: TEC_PUBLISHED_AT, events }, null, 2)}\n`,
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
  const runLine = JSON.stringify({
    catalogue_schema_version: 1,
    ingestion_run_id: `run:${TEC_DATASET_ID}:${TEC_PUBLISHED_AT}`,
    dataset_id: TEC_DATASET_ID,
    source_release_id: sourceReleaseId,
    started_at: TEC_PUBLISHED_AT,
    finished_at: TEC_PUBLISHED_AT,
    status: "succeeded",
  });
  appendFileSync(resolve(catalogue, "ingestion_runs.ndjson"), `${runLine}\n`);
}

console.log(
  `projects ${projects.length} repd ${repd.length} tec ${parsedTec.rows.length} links ${links.length} release ${sourceReleaseId}`,
);
