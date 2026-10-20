import { z } from "zod";
import { PROJECT_TECHNOLOGIES } from "@/lib/projects/technology";

export const REPD_PIPELINE_FILE = "repd_pipeline.ndjson";
export const REPD_PIPELINE_EDITION_FILE = "repd_pipeline.json";

export const REPD_SHORT_STATUSES = [
  "awaiting_construction",
  "operational",
  "application_submitted",
  "application_refused",
  "revised",
  "application_withdrawn",
  "under_construction",
  "abandoned",
  "permission_expired",
  "appeal_refused",
  "appeal_withdrawn",
  "decommissioned",
  "no_application_required",
  "appeal_lodged",
] as const;

export type RepdShortStatus = (typeof REPD_SHORT_STATUSES)[number];

export const PIPELINE_COUNTRIES = ["England", "Scotland", "Wales", "Northern Ireland"] as const;

export type PipelineCountry = (typeof PIPELINE_COUNTRIES)[number];

export const GB_PIPELINE_COUNTRIES = ["England", "Scotland", "Wales"] as const;

export type GbPipelineCountry = (typeof GB_PIPELINE_COUNTRIES)[number];

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "expected a real date");

export const pipelineRecordSchema = z
  .object({
    ref: z.string().min(1),
    name: z.string().min(1),
    technology: z.enum(PROJECT_TECHNOLOGIES),
    country: z.enum(PIPELINE_COUNTRIES).nullable(),
    status: z.enum(REPD_SHORT_STATUSES),
    mw: z.number().finite().nullable(),
    submitted: day.nullable(),
    granted: day.nullable(),
    appeal_granted: day.nullable(),
    sos_granted: day.nullable(),
    refused: day.nullable(),
    withdrawn: day.nullable(),
    appeal_lodged: day.nullable(),
    appeal_withdrawn: day.nullable(),
    appeal_refused: day.nullable(),
    sos_refused: day.nullable(),
    expired: day.nullable(),
    construction: day.nullable(),
    operational: day.nullable(),
  })
  .strict();

export type PipelineRecord = z.infer<typeof pipelineRecordSchema>;

export const pipelineEditionSchema = z
  .object({
    catalogue_schema_version: z.literal(1),
    source_release_id: z.string().min(1),
    edition: z.string().min(1),
    published_at: z.string().min(1),
    edition_day: day,
    extract_sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    row_count: z.number().int().positive(),
  })
  .strict();

export type PipelineEdition = z.infer<typeof pipelineEditionSchema>;
