import { z } from "zod";
import { CATALOGUE_SCHEMA_VERSION, instantSchema } from "@/lib/catalogue/schema";
import { DISPLAY_STAGE_RULE } from "@/lib/projects/copy";
import {
  AGREEMENT_STATUSES,
  CONNECTION_GATES,
  CONNECTION_STAGES,
  CONSTRUCTION_STATUSES,
  DISPLAY_STAGES,
  OPERATIONAL_STATUSES,
  PLANNING_STATUSES,
} from "@/lib/projects/status";
import { PROJECT_TECHNOLOGIES } from "@/lib/projects/technology";

const id = z.string().regex(/^epj_[a-f0-9]{16}$/);
const text = z.string().refine((value) => value.trim().length > 0, "required");
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "expected a real date");

const sourceId = z.enum(["desnz-repd", "neso-open-data"]);

export const projectMemberSchema = z
  .object({
    source_id: sourceId,
    external_ref: text,
  })
  .strict();

export const energyProjectSchema = z
  .object({
    project_id: id,
    name: text,
    technology: z.enum(PROJECT_TECHNOLOGIES),
    country: z.enum(["England", "Scotland", "Wales"]).nullable(),
    region: z.string().nullable(),
    planning_status: z.enum(PLANNING_STATUSES),
    planning_decision_date: day.nullable(),
    planning_source_id: sourceId.nullable(),
    planning_release_id: text.nullable(),
    construction_status: z.enum(CONSTRUCTION_STATUSES),
    construction_evidence_date: day.nullable(),
    construction_source_id: sourceId.nullable(),
    construction_release_id: text.nullable(),
    connection_stage: z.enum(CONNECTION_STAGES),
    connection_gate: z.enum(CONNECTION_GATES),
    agreement_status: z.enum(AGREEMENT_STATUSES),
    expected_energisation: day.nullable(),
    connection_source_id: sourceId.nullable(),
    connection_release_id: text.nullable(),
    operational_status: z.enum(OPERATIONAL_STATUSES),
    commissioning_date: day.nullable(),
    closure_date: day.nullable(),
    operational_source_id: sourceId.nullable(),
    operational_release_id: text.nullable(),
    power_mw: z.number().finite().nullable(),
    connection_capacity_mw: z.number().finite().nullable(),
    storage_energy_mwh: z.number().finite().nullable(),
    display_stage: z.enum(DISPLAY_STAGES),
    display_stage_rule: z.literal(DISPLAY_STAGE_RULE),
    members: z.array(projectMemberSchema).min(1),
  })
  .strict();

export const mergeDecisionSchema = z
  .object({
    repd_ref: text,
    tec_project_id: text,
    method: z.enum(["unique_name", "manual"]),
    note: text,
  })
  .strict();

export const projectMergesSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    links: z.array(mergeDecisionSchema),
    unlinks: z.array(mergeDecisionSchema),
  })
  .strict();

export const changeEventSchema = z
  .object({
    entity: text,
    observed_at: instantSchema,
    effective_at: day.nullable(),
    old: z.union([z.string(), z.number(), z.null()]),
    new: z.union([z.string(), z.number(), z.null()]),
    old_release_id: text,
    new_release_id: text,
    comparison: z.enum(["field", "not_in_release"]),
    field: text,
  })
  .strict();

export const changeEventsFileSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    observed_at: instantSchema,
    events: z.array(changeEventSchema),
  })
  .strict();

export type EnergyProject = z.infer<typeof energyProjectSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type MergeDecision = z.infer<typeof mergeDecisionSchema>;
export type ProjectMerges = z.infer<typeof projectMergesSchema>;
export type ChangeEvent = z.infer<typeof changeEventSchema>;
export type ChangeEventsFile = z.infer<typeof changeEventsFileSchema>;

export const PROJECTS_FILE = "energy_projects.ndjson";
export const MERGES_FILE = "project_merges.json";
export const CHANGE_EVENTS_FILE = "change_events.json";

export const REPD_PROJECT_RELEASE_ID = "desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z";
export const TEC_DATASET_ID = "neso-open-data:tec-register";
export const TEC_PUBLISHED_AT = "2026-10-13T13:58:33.755Z";
export const TEC_PROJECT_RELEASE_ID = `${TEC_DATASET_ID}:${TEC_PUBLISHED_AT}`;
