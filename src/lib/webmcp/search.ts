import { assetHref } from "@/lib/assets/href";
import { formatMw, technologyLabel } from "@/lib/assets/labels";
import { searchAssets } from "@/lib/assets/query";
import type { AssetIndexRow } from "@/lib/assets/types";
import { projectSearchHref, searchProjects, type ProjectSearchRow } from "@/lib/search/project-index";
import { compareCatalogueHits } from "@/lib/search/rank";
import { searchTasks } from "@/lib/search/tasks";

const CANDIDATE_LIMIT = 8;
const CATALOGUE_LIMIT = 8;
export const SEARCH_QUERY_MAX = 80;

export type GridSearchHit = {
  kind: "page" | "project" | "asset";
  title: string;
  href: string;
  detail: string;
};

/**
 * Same order as the header search: matching pages first, then stations and
 * projects ranked together, with an operating station ahead of a same-named project.
 * An empty query lists the pages and does not scan the registers.
 */
export function searchGrid(
  query: string,
  assets: readonly AssetIndexRow[] | null,
  projects: readonly ProjectSearchRow[] | null,
): GridSearchHit[] {
  const pages = searchTasks(query).map((task) => ({
    kind: "page" as const,
    title: task.title,
    href: task.href,
    detail: task.detail,
  }));
  const projectHits = projects ? searchProjects(projects, query, CANDIDATE_LIMIT) : [];
  const assetHits = assets ? searchAssets(assets, query, CANDIDATE_LIMIT) : [];
  const catalogue = [
    ...projectHits.map((row) => ({
      kind: "project" as const,
      title: row.name,
      href: projectSearchHref(row),
      detail: projectDetail(row),
      group: "Projects",
    })),
    ...assetHits.map((row) => ({
      kind: "asset" as const,
      title: row.name,
      href: assetHref(row),
      detail: assetDetail(row),
      group: "Assets",
    })),
  ];
  catalogue.sort((left, right) => compareCatalogueHits(query, left, right));
  return [
    ...pages,
    ...catalogue.slice(0, CATALOGUE_LIMIT).map((hit) => ({
      kind: hit.kind,
      title: hit.title,
      href: hit.href,
      detail: hit.detail,
    })),
  ];
}

function projectDetail(row: ProjectSearchRow): string {
  return [row.stage, row.technology, row.place, row.mw === null ? "" : formatMw(row.mw)]
    .filter((part) => part.length > 0)
    .join(" · ");
}

function assetDetail(row: AssetIndexRow): string {
  return `${technologyLabel(row.technology)} · ${row.region} · ${formatMw(row.mw)}${row.operator ? ` · ${row.operator}` : ""}`;
}

export function parseSearchQuery(input: unknown): { query: string } | { notice: string } {
  if (input == null) {
    return { query: "" };
  }
  if (typeof input !== "object") {
    return { notice: "The input must be an object." };
  }
  const query = (input as { query?: unknown }).query;
  if (query == null) {
    return { query: "" };
  }
  if (typeof query !== "string") {
    return { notice: "The query must be text." };
  }
  if (query.length > SEARCH_QUERY_MAX) {
    return { notice: `The query must be ${SEARCH_QUERY_MAX} characters or fewer.` };
  }
  return { query };
}
