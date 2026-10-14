import { z } from "zod";
import { TECHNOLOGIES } from "@/lib/catalogue/assets/technologies";
import { CATALOGUE_SCHEMA_VERSION } from "@/lib/catalogue/schema";

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{16}$`));

const text = z.string().refine((value) => value.trim().length > 0, "required");

export const assetRecordSchema = z
  .object({
    asset_id: id("ast"),
    name: text,
    technology: z.enum(TECHNOLOGIES),
    status: z.literal("operational"),
    country: z.string().nullable(),
    latitude: z.number().finite().nullable(),
    longitude: z.number().finite().nullable(),
  })
  .strict();

export const projectRecordSchema = z
  .object({
    project_id: id("prj"),
    asset_id: id("ast"),
    name: text,
    source_id: z.enum(["desnz-repd", "desnz-dukes"]),
    external_ref: text,
  })
  .strict();

export const capacityRecordSchema = z
  .object({
    capacity_record_id: id("cap"),
    asset_id: id("ast"),
    project_id: id("prj"),
    source_id: z.enum(["desnz-repd", "desnz-dukes"]),
    source_release_id: text,
    mw: z.number().finite(),
    counts: z.boolean(),
  })
  .strict();

export const mappingRecordSchema = z
  .object({
    scheme: z.enum(["REPD_REF", "DUKES_NAME"]),
    source_entity_id: text,
    asset_id: id("ast"),
  })
  .strict();

export const matchRecordSchema = z
  .object({
    match_id: id("mat"),
    confidence: z.enum(["high", "medium", "manual"]),
    rule: z.enum(["manual", "coordinates", "coordinate_group", "name", "name_group"]),
    dukes_site_codes: z.array(text).min(1),
    dukes_names: z.array(text).min(1),
    repd_refs: z.array(text).min(1),
    distance_m: z.number().finite().nullable(),
    repd_mw: z.number().finite(),
    dukes_mw: z.number().finite(),
    counts_source: z.enum(["desnz-repd", "desnz-dukes"]),
  })
  .strict();

const matchLinkSchema = z
  .object({
    dukes_site_codes: z.array(text).min(1),
    repd_refs: z.array(text).min(1),
    note: text,
  })
  .strict();

export const matchOverridesSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    links: z.array(matchLinkSchema),
    unlinks: z.array(matchLinkSchema),
  })
  .strict();

export const dukesHeadlineSchema = z
  .object({
    major_power_producers: z.number().finite(),
    all_generators: z.number().finite(),
  })
  .strict();
