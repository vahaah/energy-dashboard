import { technologyLabel } from "@/lib/assets/labels";
import { queryAssets, type AssetListQuery, type AssetListResult } from "@/lib/assets/query";
import { ASSET_PAGE_SIZE, type AssetIndexRow } from "@/lib/assets/types";
import { countLabels, type CountRow } from "@/lib/projects/list";

export type AssetListRow = {
  id: string;
  name: string;
  technology: AssetIndexRow["technology"];
  status: AssetIndexRow["status"];
  mw: number | null;
  region: string;
  location: string;
  source: AssetIndexRow["source"];
  sources: AssetIndexRow["source"][];
};

export function toAssetListRow(row: AssetIndexRow): AssetListRow {
  return {
    id: row.id,
    name: row.name,
    technology: row.technology,
    status: row.status,
    mw: row.mw,
    region: row.region,
    location: row.location,
    source: row.source,
    sources: row.sources,
  };
}

export function assetCounts(rows: readonly AssetIndexRow[]): {
  technology: CountRow[];
  nation: CountRow[];
  stage: CountRow[];
} {
  const stages = new Map<string, number>();
  for (const row of rows) {
    const label = row.status === "operational" ? "Operational" : row.status;
    stages.set(label, (stages.get(label) ?? 0) + 1);
  }
  return {
    technology: countLabels(rows.map((row) => ({ label: technologyLabel(row.technology) }))),
    nation: countLabels(rows.map((row) => ({ label: row.country ?? "Not published" }))),
    stage: [...stages.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "en")),
  };
}

export const ASSET_LIST_DEFAULT: AssetListQuery = {
  q: "",
  technology: null,
  status: null,
  source: null,
  region: "",
  sort: "name",
  dir: "asc",
  page: 1,
  pageSize: ASSET_PAGE_SIZE,
};

export function isDefaultAssetQuery(query: AssetListQuery, preset: "flows" | null): boolean {
  return (
    preset == null &&
    query.q === "" &&
    query.technology == null &&
    query.status == null &&
    query.source == null &&
    query.region === "" &&
    query.sort === "name" &&
    query.dir === "asc" &&
    query.page === 1
  );
}

export function queryAssetPage(
  rows: readonly AssetIndexRow[],
  query: AssetListQuery,
  preset: "flows" | null,
): AssetListResult {
  const scoped =
    preset === "flows" ? rows.filter((row) => row.technology === "interconnector" || row.technology === "gas_terminal") : rows;
  return queryAssets(scoped, query);
}
