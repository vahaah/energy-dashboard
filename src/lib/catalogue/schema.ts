import { z } from "zod";

/**
 * Checked-in catalogue. Version 1 is git JSON only: no database.
 * Large geometry is a URL on the layer row (Vercel Blob for PMTiles). The
 * bytes are not in this schema.
 * `dataset_id` is `{source_id}:{catalogue_key}`.
 * `source_release_id` is `{dataset_id}:{published_at}` when the publisher
 * timestamps the extract, otherwise `{dataset_id}:{content_hash}`.
 */

export const CATALOGUE_SCHEMA_VERSION = 1;

export const CATALOGUE_SOURCE_IDS = [
  "elexon-bmrs",
  "neso-open-data",
  "carbon-intensity",
  "sheffield-pv-live",
  "eia",
  "world-bank-pink-sheet",
  "national-gas",
  "desnz-repd",
  "desnz-dukes",
] as const;

/**
 * Asset register written by the REPD / DUKES adapters. These files are not part
 * of `CATALOGUE_FILES`: a pull request baseline only freezes `source_releases`,
 * and the base branch does not have the register until this import lands.
 */
export const ASSET_REGISTER_FILES = {
  assets: "assets.ndjson",
  projects: "projects.ndjson",
  capacity: "capacity_records.ndjson",
  mappings: "source_entity_mappings.ndjson",
  matches: "asset_matches.ndjson",
  parties: "asset_parties.ndjson",
  overrides: "asset_match_overrides.json",
  summary: "asset_summary.json",
} as const;

export const CATALOGUE_FILES = {
  sources: "sources.json",
  datasets: "datasets.json",
  releases: "source_releases.ndjson",
  runs: "ingestion_runs.ndjson",
} as const;

const ISO_DURATION =
  /^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;

const ISO_INSTANT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

/**
 * `2026-02-31T00:00:00.000Z` matches the shape and then overflows in `Date`.
 * Compare that round-trip with the same millisecond the string claims.
 */
export function isUtcInstant(value: string): boolean {
  const match = ISO_INSTANT.exec(value);
  if (!match?.[1]) {
    return false;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const fraction = (match[2] ?? "").padEnd(3, "0").slice(0, 3);
  return parsed.toISOString() === `${match[1]}.${fraction}Z`;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/;

/** National Gas Data Portal publication ids. PUBOB603 is the System Average Price. */
export const NATIONAL_GAS_PUBLICATION_ID = /^PUB[A-Z0-9]+$/;

export const isoDurationSchema = z.string().regex(ISO_DURATION, "expected an ISO-8601 duration");

export const instantSchema = z.string().refine(isUtcInstant, "expected a real UTC instant");

const requiredText = z.string().refine((value) => value.trim().length > 0, "required");

export const httpUrlSchema = z
  .string()
  .regex(/^https:\/\/\S+$/, "expected an https URL");

export const sourceIdSchema = z.enum(CATALOGUE_SOURCE_IDS);

export const sourceSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    source_id: sourceIdSchema,
    name: requiredText,
    url: httpUrlSchema,
    used_for: requiredText,
    licence: requiredText,
    licence_url: httpUrlSchema,
    attribution: requiredText,
    cadence: isoDurationSchema,
  })
  .strict();

export const datasetSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    dataset_id: requiredText,
    source_id: sourceIdSchema,
    catalogue_key: requiredText,
    cadence: isoDurationSchema,
    metric_ids: z.array(requiredText),
    /** Plant register. Empty `metric_ids`. Not a homepage series. */
    register: z.literal("assets").optional(),
  })
  .strict()
  .refine(
    (dataset) =>
      dataset.register === "assets" ? dataset.metric_ids.length === 0 : dataset.metric_ids.length > 0,
    "series datasets list metric_ids; asset datasets do not",
  );

/**
 * Snapshot of the extracted payload. `content_hash` is the canonical JSON of
 * this value. Catalogue key, cadence, and metric ids stay on the dataset, so
 * a new extract of the same series gets a new hash.
 */
export const releaseContentSchema = z.json();

export const sourceReleaseSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    source_release_id: requiredText,
    dataset_id: requiredText,
    published_at: instantSchema.nullable(),
    content_hash: z.string().regex(SHA256, "expected sha256:<64 hex>"),
    content: releaseContentSchema,
  })
  .strict();

export const ingestionRunStatusSchema = z.enum(["succeeded", "failed", "partial"]);

export const ingestionRunSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    ingestion_run_id: requiredText,
    dataset_id: requiredText,
    source_release_id: requiredText.nullable(),
    started_at: instantSchema,
    finished_at: instantSchema.nullable(),
    status: ingestionRunStatusSchema,
  })
  .strict();

export const sourcesFileSchema = z.array(sourceSchema);
export const datasetsFileSchema = z.array(datasetSchema);

export type CatalogueSource = z.infer<typeof sourceSchema>;
export type CatalogueDataset = z.infer<typeof datasetSchema>;
export type CatalogueReleaseContent = z.infer<typeof releaseContentSchema>;
export type SourceRelease = z.infer<typeof sourceReleaseSchema>;
export type IngestionRun = z.infer<typeof ingestionRunSchema>;
export type IngestionRunStatus = z.infer<typeof ingestionRunStatusSchema>;

export function catalogueDatasetId(sourceId: string, catalogueKey: string): string {
  return `${sourceId}:${catalogueKey}`;
}

export function catalogueReleaseId(
  datasetId: string,
  publishedAt: string | null,
  contentHash: string,
): string {
  return `${datasetId}:${publishedAt ?? contentHash}`;
}
