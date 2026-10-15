import { z } from "zod";
import { CATALOGUE_SCHEMA_VERSION, httpUrlSchema, instantSchema } from "@/lib/catalogue/schema";
import { LAYER_PRECISIONS, type LayerPrecision } from "@/lib/map/precision";

/**
 * Layer catalogue. Not part of `CATALOGUE_FILES`: the base branch has no
 * `layers.json` until this publish lands, and the release-line freeze only
 * covers `source_releases.ndjson`.
 */
export const LAYER_FILES = {
  layers: "layers.json",
  watch: "layer_watch.json",
} as const;

export { LAYER_PRECISIONS, type LayerPrecision };

export const LAYER_KINDS = ["basemap", "geojson", "pmtiles"] as const;

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const EPSG = /^EPSG:\d+$/;

const requiredText = z.string().refine((value) => value.trim().length > 0, "required");

export const layerPrecisionSchema = z.enum(LAYER_PRECISIONS);
export const layerKindSchema = z.enum(LAYER_KINDS);

export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const layerZoomSchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .strict();

export const mapLayerSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    id: requiredText,
    kind: layerKindSchema,
    edition: requiredText,
    source_crs: z.string().regex(EPSG, "expected EPSG:nnnn"),
    tolerance: z.number().nonnegative().nullable(),
    bbox: bboxSchema.nullable(),
    url: httpUrlSchema,
    bytes: z.number().int().positive(),
    sha256: z.string().regex(SHA256, "expected sha256:<64 hex>"),
    precision: layerPrecisionSchema,
    licence: requiredText,
    licence_url: httpUrlSchema,
    attribution: requiredText,
    accuracy_warning: requiredText.nullable(),
    release_id: requiredText,
    default_visible: z.boolean(),
    zoom: layerZoomSchema.nullable(),
  })
  .strict();

export const layersFileSchema = z.array(mapLayerSchema);

export const layerWatchEntrySchema = z
  .object({
    id: requiredText,
    package_url: httpUrlSchema,
    source_url: httpUrlSchema,
    source_etag: z.string().nullable(),
    source_sha256: z.string().regex(SHA256, "expected sha256:<64 hex>"),
    checked_at: instantSchema,
  })
  .strict();

export const layerWatchFileSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    layers: z.array(layerWatchEntrySchema),
  })
  .strict();

export type MapLayer = z.infer<typeof mapLayerSchema>;
export type LayerKind = z.infer<typeof layerKindSchema>;
export type LayerWatchEntry = z.infer<typeof layerWatchEntrySchema>;
export type LayerWatchFile = z.infer<typeof layerWatchFileSchema>;
