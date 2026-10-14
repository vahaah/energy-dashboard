import { z } from "zod";

/**
 * Checked-in catalogue. Version 1 is git JSON only: no database, no blob store.
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
] as const;

export const CATALOGUE_FILES = {
  sources: "sources.json",
  datasets: "datasets.json",
  releases: "source_releases.ndjson",
  runs: "ingestion_runs.ndjson",
} as const;

const ISO_DURATION =
  /^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

const SHA256 = /^sha256:[a-f0-9]{64}$/;

/** National Gas Data Portal publication ids. PUBOB603 is the System Average Price. */
export const NATIONAL_GAS_PUBLICATION_ID = /^PUB[A-Z0-9]+$/;

export const isoDurationSchema = z.string().regex(ISO_DURATION, "expected an ISO-8601 duration");

export const instantSchema = z.string().regex(ISO_INSTANT, "expected a UTC instant");

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
    metric_ids: z.array(requiredText).min(1),
  })
  .strict();

export const releaseContentSchema = z
  .object({
    catalogue_key: requiredText,
    cadence: isoDurationSchema,
    metric_ids: z.array(requiredText).min(1),
  })
  .strict();

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
