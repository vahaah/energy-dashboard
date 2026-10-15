import type { Technology } from "@/lib/catalogue/assets/technologies";
import { DUKES_SOURCE_ID, REPD_SOURCE_ID } from "@/lib/catalogue/assets/technologies";

export type CatalogueStation = {
  sourceId: typeof REPD_SOURCE_ID | typeof DUKES_SOURCE_ID;
  externalRef: string;
  name: string;
  technology: Technology;
  country: string | null;
  easting: number | null;
  northing: number | null;
  mw: number | null;
};

export type AssetRecord = {
  asset_id: string;
  name: string;
  technology: Technology;
  status: "operational";
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ProjectRecord = {
  project_id: string;
  asset_id: string;
  name: string;
  source_id: typeof REPD_SOURCE_ID | typeof DUKES_SOURCE_ID;
  external_ref: string;
};

export type CapacityRecord = {
  capacity_record_id: string;
  asset_id: string;
  project_id: string;
  source_id: typeof REPD_SOURCE_ID | typeof DUKES_SOURCE_ID;
  source_release_id: string;
  mw: number;
  counts: boolean;
};

export type MappingRecord = {
  scheme: "REPD_REF" | "DUKES_NAME";
  source_entity_id: string;
  asset_id: string;
};

export type MatchConfidence = "high" | "medium" | "manual";

export type MatchRule = "manual" | "coordinates" | "coordinate_group" | "name" | "name_group";

export type MatchRecord = {
  match_id: string;
  confidence: MatchConfidence;
  rule: MatchRule;
  dukes_site_codes: string[];
  dukes_names: string[];
  repd_refs: string[];
  distance_m: number | null;
  repd_mw: number;
  dukes_mw: number;
  counts_source: typeof REPD_SOURCE_ID | typeof DUKES_SOURCE_ID;
};

export type MatchLink = {
  dukes_site_codes: string[];
  repd_refs: string[];
  note: string;
};

export type MatchOverrides = {
  catalogue_schema_version: 1;
  links: MatchLink[];
  unlinks: MatchLink[];
};

export type AssetRegister = {
  assets: AssetRecord[];
  projects: ProjectRecord[];
  capacity: CapacityRecord[];
  mappings: MappingRecord[];
  matches: MatchRecord[];
};

export type ReleaseBinding = {
  repd: string;
  dukes: string;
};

export const EMPTY_OVERRIDES: MatchOverrides = {
  catalogue_schema_version: 1,
  links: [],
  unlinks: [],
};
