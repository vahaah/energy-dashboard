import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import { CATALOGUE_SCHEMA_VERSION, catalogueReleaseId } from "@/lib/catalogue/schema";
import type { WholeEnergyEdition } from "@/lib/whole-energy/schema";

const DATASET_ID = "desnz-dukes:dukes-1.1";

type ReleaseLine = {
  source_release_id?: string;
  content_hash?: string;
  content?: unknown;
};

type RunLine = {
  ingestion_run_id?: string;
};

export type WholeEnergyCommit = {
  sourceReleaseId: string;
  wroteRelease: boolean;
  ingestionRunId: string;
};

function readLines(path: string): string[] {
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.length > 0);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Writes the checked-in edition only after the release id is new or unchanged.
 * A rerun of the same extract appends an ingestion run and leaves the release line.
 */
export function commitWholeEnergyEdition(
  root: string,
  edition: WholeEnergyEdition,
  now = new Date(),
): WholeEnergyCommit {
  const catalogue = resolve(root, "data/catalogue");
  const releasesPath = resolve(catalogue, "source_releases.ndjson");
  const runsPath = resolve(catalogue, "ingestion_runs.ndjson");
  const editionPath = resolve(catalogue, "whole-energy.json");
  const contentHash = sha256Prefixed(edition);
  const sourceReleaseId = catalogueReleaseId(DATASET_ID, edition.published_at, contentHash);
  mkdirSync(catalogue, { recursive: true });
  const existing = readLines(releasesPath)
    .map((line) => JSON.parse(line) as ReleaseLine)
    .find((line) => line.source_release_id === sourceReleaseId);
  if (existing && (existing.content_hash !== contentHash || sha256Prefixed(existing.content) !== contentHash)) {
    throw new Error(`${sourceReleaseId} is already committed with different content`);
  }

  writeFileSync(editionPath, `${JSON.stringify(edition, null, 2)}\n`);
  if (!existing) {
    const release = {
      catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
      source_release_id: sourceReleaseId,
      dataset_id: DATASET_ID,
      published_at: edition.published_at,
      content_hash: contentHash,
      content: edition,
    };
    appendFileSync(releasesPath, `${JSON.stringify(release)}\n`);
  }

  const taken = new Set(
    readLines(runsPath)
      .map((line) => (JSON.parse(line) as RunLine).ingestion_run_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const clock = now.toISOString();
  let ingestionRunId = `run:${DATASET_ID}:${clock}`;
  let suffix = 2;
  while (taken.has(ingestionRunId)) {
    ingestionRunId = `run:${DATASET_ID}:${clock}:${suffix}`;
    suffix += 1;
  }
  const run = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    ingestion_run_id: ingestionRunId,
    dataset_id: DATASET_ID,
    source_release_id: sourceReleaseId,
    started_at: clock,
    finished_at: clock,
    status: "succeeded",
  };
  appendFileSync(runsPath, `${JSON.stringify(run)}\n`);
  return { sourceReleaseId, wroteRelease: !existing, ingestionRunId };
}
