import { z } from "zod";
import { CATALOGUE_SCHEMA_VERSION, httpUrlSchema } from "@/lib/catalogue/schema";

export const LINK_FILES = {
  interconnectors: "interconnectors.json",
  gasTerminals: "gas_terminals.json",
} as const;

/** Wider than Great Britain so schematic country labels for connected markets fit. */
export const SCHEMATIC_BBOX = {
  west: -12,
  south: 47,
  east: 14,
  north: 64,
} as const;

/** Great Britain only. A gas pin outside this box is not a cited GB terminal. */
export const GAS_PIN_BBOX = {
  west: -9,
  south: 49,
  east: 2.5,
  north: 61.5,
} as const;

/** GB landing points. Counterparty ends use the wider schematic box. */
export const GB_LANDING_BBOX = {
  west: -7.5,
  south: 49.8,
  east: 1.8,
  north: 58.8,
} as const;

export const STRAIGHT_LINE_LABEL = "Straight line, not the cable route.";

/** Licences that permit storing a coordinate. National Gas route maps are not in this set. */
export const PERMITTED_COORDINATE_LICENCES = ["Open Government Licence v3.0", "CC BY 4.0"] as const;

const assetId = z.string().regex(/^ast_[a-f0-9]{16}$/);
const text = z.string().refine((value) => value.trim().length > 0, "required");

export const interconnectorSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    interconnector_id: assetId,
    name: text,
    fuelinst_code: z.string().regex(/^INT[A-Z0-9]+$/),
    status: z.literal("operational"),
    remote_country: text,
    gb_label: text,
    remote_label: text,
    gb_longitude: z.number().finite(),
    gb_latitude: z.number().finite(),
    remote_longitude: z.number().finite(),
    remote_latitude: z.number().finite(),
    precision: z.literal("schematic"),
    coordinate_basis: z.literal("landing_point"),
    remote_outside_gb: z.boolean(),
    gb_geonames_id: z.number().int().positive(),
    remote_geonames_id: z.number().int().positive(),
    coordinate_licence: z.enum(PERMITTED_COORDINATE_LICENCES),
    coordinate_licence_url: httpUrlSchema,
    gb_coordinate_citation: text,
    remote_coordinate_citation: text,
    source_id: z.literal("elexon-bmrs"),
    source_url: httpUrlSchema,
    citation: text,
  })
  .strict();

export const gasTerminalSchema = z
  .object({
    catalogue_schema_version: z.literal(CATALOGUE_SCHEMA_VERSION),
    asset_id: assetId,
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: text,
    status: z.literal("operational"),
    role: z.enum(["entry", "exit"]),
    latitude: z.number().finite().nullable(),
    longitude: z.number().finite().nullable(),
    coordinate_licence: z.enum(PERMITTED_COORDINATE_LICENCES).nullable(),
    coordinate_licence_url: httpUrlSchema.nullable(),
    coordinate_citation: text.nullable(),
    source_id: z.literal("national-gas"),
    source_url: httpUrlSchema,
    citation: text,
  })
  .strict();

export const interconnectorsFileSchema = z.array(interconnectorSchema).min(1);
export const gasTerminalsFileSchema = z.array(gasTerminalSchema).min(1);

export type InterconnectorRecord = z.infer<typeof interconnectorSchema>;
export type GasTerminalRecord = z.infer<typeof gasTerminalSchema>;

export const RESIDUAL_IMPORTS_CODE = "INTNESO";

export const SCHEMATIC_LINK_LABEL = "Schematic link, not the cable route.";
