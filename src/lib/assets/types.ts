import type { Technology } from "@/lib/catalogue/assets/technologies";
import { TECHNOLOGIES } from "@/lib/catalogue/assets/technologies";
import type { LayerPrecision } from "@/lib/map/precision";

export const ASSET_SOURCES = ["REPD", "DUKES", "Elexon", "National Gas"] as const;
export type AssetSourceLabel = (typeof ASSET_SOURCES)[number];

export const LINK_TECHNOLOGIES = ["interconnector", "gas_terminal"] as const;
export type LinkTechnology = (typeof LINK_TECHNOLOGIES)[number];
export type AssetTechnology = Technology | LinkTechnology;

export const DIRECTORY_TECHNOLOGIES = [...TECHNOLOGIES, ...LINK_TECHNOLOGIES] as const;

export function isAssetSource(value: string): value is AssetSourceLabel {
  return (ASSET_SOURCES as readonly string[]).includes(value);
}

export function isAssetTechnology(value: string): value is AssetTechnology {
  return (DIRECTORY_TECHNOLOGIES as readonly string[]).includes(value);
}

export function isCatalogueStation(technology: AssetTechnology): boolean {
  return !(LINK_TECHNOLOGIES as readonly string[]).includes(technology);
}

export const ASSET_SORTS = ["name", "technology", "status", "mw", "region", "source"] as const;
export type AssetSort = (typeof ASSET_SORTS)[number];

export const UNLOCATED_REGION = "Not located";

export type AssetIndexRow = {
  id: string;
  name: string;
  operator: string;
  technology: AssetTechnology;
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
  current: boolean;
};

export type AssetLinkView = {
  fuelinstCode: string | null;
  citation: string;
  area: string;
  line: {
    code: string;
    gbLabel: string;
    remoteLabel: string;
    gbLongitude: number;
    gbLatitude: number;
    remoteLongitude: number;
    remoteLatitude: number;
  } | null;
  sourceRecords: { id: string; source: string; edition: string; href: string }[];
  attributions: string[];
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
  link: AssetLinkView | null;
};

export type MapPoint = {
  id: string;
  name: string;
  technology: AssetTechnology;
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
