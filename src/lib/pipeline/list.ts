import type { PipelineStageId, PipelineTableRow } from "@/lib/pipeline/model";

export const PIPELINE_PAGE_SIZE = 40;

export const PIPELINE_SORTS = ["name", "stage", "technology", "nation", "capacity", "statusDate"] as const;
export type PipelineSortKey = (typeof PIPELINE_SORTS)[number];

const STAGE_ORDER: Record<PipelineStageId, number> = {
  under_construction: 0,
  consented: 1,
  in_planning: 2,
};

export type PipelineListQuery = {
  stage: string;
  technology: string;
  nation: string;
  sort: PipelineSortKey;
  direction: "asc" | "desc";
  page: number;
};

export const PIPELINE_LIST_DEFAULT: PipelineListQuery = {
  stage: "all",
  technology: "all",
  nation: "all",
  sort: "capacity",
  direction: "desc",
  page: 1,
};

export type PipelineListPage = {
  rows: PipelineTableRow[];
  total: number;
  page: number;
  pages: number;
};

export function isPipelineSort(value: string): value is PipelineSortKey {
  return (PIPELINE_SORTS as readonly string[]).includes(value);
}

export function pipelineFacets(rows: readonly PipelineTableRow[]): { technologies: string[]; nations: string[] } {
  return {
    technologies: unique(rows.map((row) => row.technologyLabel)),
    nations: unique(rows.map((row) => row.nation)),
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

export function isDefaultPipelineQuery(query: PipelineListQuery): boolean {
  return (
    query.stage === "all" &&
    query.technology === "all" &&
    query.nation === "all" &&
    query.sort === "capacity" &&
    query.direction === "desc" &&
    query.page === 1
  );
}

export function matchingPipelineRows(rows: readonly PipelineTableRow[], query: PipelineListQuery): PipelineTableRow[] {
  const filtered = rows.filter((row) => {
    if (query.stage !== "all" && row.stage !== query.stage) {
      return false;
    }
    if (query.technology !== "all" && row.technologyLabel !== query.technology) {
      return false;
    }
    if (query.nation !== "all" && row.nation !== query.nation) {
      return false;
    }
    return true;
  });
  return filtered.slice().sort((left, right) => compareRows(left, right, query.sort, query.direction));
}

export function selectPipelineRows(rows: readonly PipelineTableRow[], query: PipelineListQuery): PipelineListPage {
  const sorted = matchingPipelineRows(rows, query);
  const pages = Math.max(1, Math.ceil(sorted.length / PIPELINE_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const start = (page - 1) * PIPELINE_PAGE_SIZE;
  return {
    rows: sorted.slice(start, start + PIPELINE_PAGE_SIZE),
    total: sorted.length,
    page,
    pages,
  };
}

function compareRows(
  left: PipelineTableRow,
  right: PipelineTableRow,
  key: PipelineSortKey,
  direction: "asc" | "desc",
): number {
  const sign = direction === "asc" ? 1 : -1;
  const base = compareKey(left, right, key);
  if (base !== 0) {
    return base * sign;
  }
  return left.name.localeCompare(right.name, "en");
}

function compareKey(left: PipelineTableRow, right: PipelineTableRow, key: PipelineSortKey): number {
  switch (key) {
    case "name":
      return left.name.localeCompare(right.name, "en");
    case "stage":
      return STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage];
    case "technology":
      return left.technologyLabel.localeCompare(right.technologyLabel, "en");
    case "nation":
      return left.nation.localeCompare(right.nation, "en");
    case "capacity":
      return (left.mw ?? Number.NEGATIVE_INFINITY) - (right.mw ?? Number.NEGATIVE_INFINITY);
    case "statusDate":
      return (left.statusDate ?? "").localeCompare(right.statusDate ?? "");
    default: {
      const neverKey: never = key;
      throw new Error(`Unknown sort ${String(neverKey)}`);
    }
  }
}
