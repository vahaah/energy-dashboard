import type { Technology } from "@/lib/catalogue/assets/technologies";
import type { LayerPrecision } from "@/lib/map/precision";

export const ASSET_SOURCES = ["REPD", "DUKES"] as const;
export type AssetSourceLabel = (typeof ASSET_SOURCES)[number];

export const ASSET_SORTS = ["name", "technology", "status", "mw", "region", "source"] as const;
export type AssetSort = (typeof ASSET_SORTS)[number];

export const UNLOCATED_REGION = "Not located";

export type AssetIndexRow = {
  id: string;
  name: string;
  operator: string;
  technology: Technology;
  status: "operational";
  mw: number | null;
  region: string;
  location: string;
  country: string | null;
  source: AssetSourceLabel;
  sources: AssetSourceLabel[];
  latitude: number | null;
  longitude: number | null;
  aka: string;
};

export type AssetProjectView = {
  projectId: string;
  name: string;
  source: AssetSourceLabel;
  externalRef: string;
  operator: string;
  region: string | null;
  county: string | null;
};

export type AssetCapacityView = {
  capacityId: string;
  source: AssetSourceLabel;
  releaseId: string;
  edition: string;
  publishedAt: string | null;
  downloadUrl: string | null;
  mw: number;
  counts: boolean;
};

export type AssetMatchView = {
  matchId: string;
  confidence: "high" | "medium" | "manual";
  rule: "manual" | "coordinates" | "coordinate_group" | "name" | "name_group";
  countsSource: AssetSourceLabel;
  repdMw: number;
  dukesMw: number;
  distanceM: number | null;
};

export type AssetDetail = {
  row: AssetIndexRow;
  projects: AssetProjectView[];
  capacity: AssetCapacityView[];
  matches: AssetMatchView[];
};

export type MapPoint = {
  id: string;
  name: string;
  technology: Technology;
  mw: number | null;
  region: string;
  longitude: number;
  latitude: number;
};

export type MapLayerView = {
  id: string;
  attribution: string;
  accuracyWarning: string | null;
  precision: LayerPrecision;
  defaultVisible: boolean;
  path: string;
  licence: string;
  licenceUrl: string;
};

export const ASSET_PAGE_SIZE = 25;
