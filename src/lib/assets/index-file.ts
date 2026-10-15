import { ASSET_SOURCES, isAssetTechnology, type AssetIndexRow, type AssetSourceLabel, type AssetTechnology } from "@/lib/assets/types";

export const ASSET_INDEX_VERSION = 1;
export const ASSET_INDEX_PATH = "/search/assets.json";

type CompactRow = [
  string,
  string,
  string,
  AssetTechnology,
  "operational",
  number | null,
  string,
  string,
  string | null,
  AssetSourceLabel,
  AssetSourceLabel[],
  number | null,
  number | null,
  string,
];

export type AssetIndexFile = {
  version: typeof ASSET_INDEX_VERSION;
  rows: CompactRow[];
};

function isTechnology(value: unknown): value is AssetTechnology {
  return typeof value === "string" && isAssetTechnology(value);
}

function isSource(value: unknown): value is AssetSourceLabel {
  return typeof value === "string" && (ASSET_SOURCES as readonly string[]).includes(value);
}

export function encodeAssetIndex(rows: readonly AssetIndexRow[]): string {
  const file: AssetIndexFile = {
    version: ASSET_INDEX_VERSION,
    rows: rows.map((row) => [
      row.id,
      row.name,
      row.operator,
      row.technology,
      row.status,
      row.mw,
      row.region,
      row.location,
      row.country,
      row.source,
      row.sources,
      row.latitude,
      row.longitude,
      row.aka,
    ]),
  };
  return `${JSON.stringify(file)}\n`;
}

export function decodeAssetIndex(value: unknown): AssetIndexRow[] {
  if (!value || typeof value !== "object") {
    throw new Error("asset index is not an object");
  }
  const version = (value as { version?: unknown }).version;
  const rows = (value as { rows?: unknown }).rows;
  if (version !== ASSET_INDEX_VERSION || !Array.isArray(rows)) {
    throw new Error("asset index version is not supported");
  }
  return rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 14) {
      throw new Error("asset index row is the wrong shape");
    }
    const [
      id,
      name,
      operator,
      technology,
      status,
      mw,
      region,
      location,
      country,
      source,
      sources,
      latitude,
      longitude,
      aka,
    ] = row;
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof operator !== "string" ||
      !isTechnology(technology) ||
      status !== "operational" ||
      (mw !== null && typeof mw !== "number") ||
      typeof region !== "string" ||
      typeof location !== "string" ||
      (country !== null && typeof country !== "string") ||
      !isSource(source) ||
      !Array.isArray(sources) ||
      !sources.every(isSource) ||
      (latitude !== null && typeof latitude !== "number") ||
      (longitude !== null && typeof longitude !== "number") ||
      typeof aka !== "string"
    ) {
      throw new Error(`asset index row ${String(id)} is invalid`);
    }
    return {
      id,
      name,
      operator,
      technology,
      status,
      mw,
      region,
      location,
      country,
      source,
      sources,
      latitude,
      longitude,
      aka,
    };
  });
}
