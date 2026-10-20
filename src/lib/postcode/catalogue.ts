import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import {
  CATALOGUE_SCHEMA_VERSION,
  catalogueReleaseId,
  httpUrlSchema,
  type SourceRelease,
} from "@/lib/catalogue/schema";
import { POSTCODE_DATASET_ID } from "@/lib/postcode/rows";

export const NSPL_EDITION = "August 2026";
export const NSPL_ITEM_ID = "9d8364ebae8b4439aa66cda440e54fc8";
export const NSPL_DOWNLOAD_URL =
  "https://www.arcgis.com/sharing/rest/content/items/9d8364ebae8b4439aa66cda440e54fc8/data";
export const NSPL_PUBLISHED_AT = "2026-09-01T11:08:22.000Z";
export const NSPL_BYTES = 185_109_467;
export const NSPL_LICENCE_READ_ON = "2026-10-20";
export const NSPL_LICENCE_PAGE = "https://www.ons.gov.uk/methodology/geography/licences";

const SHA256 = /^sha256:[a-f0-9]{64}$/;

export const postcodeReleaseContentSchema = z
  .object({
    edition: z.string().min(1),
    item_id: z.string().min(1),
    download_url: httpUrlSchema,
    bytes: z.number().int().positive(),
    licence_read_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    licence_url: httpUrlSchema,
    geography: z.literal("GB"),
    northern_ireland: z.literal("excluded"),
    extract_sha256: z.string().regex(SHA256).optional(),
  })
  .strict();

export type PostcodeReleaseContent = z.infer<typeof postcodeReleaseContentSchema>;

export const NSPL_RELEASE_CONTENT: PostcodeReleaseContent = {
  edition: NSPL_EDITION,
  item_id: NSPL_ITEM_ID,
  download_url: NSPL_DOWNLOAD_URL,
  bytes: NSPL_BYTES,
  licence_read_on: NSPL_LICENCE_READ_ON,
  licence_url: NSPL_LICENCE_PAGE,
  geography: "GB",
  northern_ireland: "excluded",
};

export function postcodeReleaseErrors(releases: readonly Pick<SourceRelease, "dataset_id" | "content">[]): string[] {
  const errors: string[] = [];
  for (const release of releases) {
    if (release.dataset_id !== POSTCODE_DATASET_ID) {
      continue;
    }
    if (!postcodeReleaseContentSchema.safeParse(release.content).success) {
      errors.push(`${POSTCODE_DATASET_ID}: release content does not match the NSPL descriptor`);
    }
  }
  return errors;
}

type ReleaseLine = {
  source_release_id?: string;
  published_at?: string | null;
  content_hash?: string;
  content?: unknown;
};

type RunLine = {
  ingestion_run_id?: string;
};

export type PostcodeCommit = {
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
 * Appends a release when `published_at` is new. A rerun of the same edition
 * leaves the committed line and appends an ingestion run.
 */
export function commitPostcodeEdition(
  catalogueDir: string,
  content: PostcodeReleaseContent,
  publishedAt: string,
  now = new Date(),
): PostcodeCommit {
  const parsed = postcodeReleaseContentSchema.parse(content);
  const releasesPath = resolve(catalogueDir, "source_releases.ndjson");
  const runsPath = resolve(catalogueDir, "ingestion_runs.ndjson");
  const contentHash = sha256Prefixed(parsed);
  const sourceReleaseId = catalogueReleaseId(POSTCODE_DATASET_ID, publishedAt, contentHash);
  const existing = readLines(releasesPath)
    .map((line) => JSON.parse(line) as ReleaseLine)
    .find((line) => line.published_at === publishedAt && line.source_release_id?.startsWith(`${POSTCODE_DATASET_ID}:`));
  if (existing && existing.source_release_id !== sourceReleaseId) {
    throw new Error(`${publishedAt} is already committed as ${existing.source_release_id}`);
  }
  if (!existing) {
    const release = {
      catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
      source_release_id: sourceReleaseId,
      dataset_id: POSTCODE_DATASET_ID,
      published_at: publishedAt,
      content_hash: contentHash,
      content: parsed,
    };
    appendFileSync(releasesPath, `${JSON.stringify(release)}\n`);
  }
  const taken = new Set(
    readLines(runsPath)
      .map((line) => (JSON.parse(line) as RunLine).ingestion_run_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const clock = now.toISOString();
  let ingestionRunId = `run:${POSTCODE_DATASET_ID}:${clock}`;
  let suffix = 2;
  while (taken.has(ingestionRunId)) {
    ingestionRunId = `run:${POSTCODE_DATASET_ID}:${clock}:${suffix}`;
    suffix += 1;
  }
  const run = {
    catalogue_schema_version: CATALOGUE_SCHEMA_VERSION,
    ingestion_run_id: ingestionRunId,
    dataset_id: POSTCODE_DATASET_ID,
    source_release_id: existing?.source_release_id ?? sourceReleaseId,
    started_at: clock,
    finished_at: clock,
    status: "succeeded" as const,
  };
  appendFileSync(runsPath, `${JSON.stringify(run)}\n`);
  return { sourceReleaseId: existing?.source_release_id ?? sourceReleaseId, wroteRelease: !existing, ingestionRunId };
}
