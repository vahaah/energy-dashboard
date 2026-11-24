import type { ProjectIndexRow } from "@/lib/projects/page-model";

export const PROJECT_PAGE_SIZE = 40;

export type CountRow = {
  label: string;
  count: number;
};

export type ProjectListQuery = {
  q: string;
  stage: string;
  technology: string;
  nation: string;
  page: number;
};

export const PROJECT_LIST_DEFAULT: ProjectListQuery = {
  q: "",
  stage: "all",
  technology: "all",
  nation: "all",
  page: 1,
};

export type ProjectListPage = {
  rows: ProjectIndexRow[];
  total: number;
  page: number;
  pages: number;
};

export function countLabels(rows: readonly { label: string }[]): CountRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "en"));
}

export function projectCounts(rows: readonly ProjectIndexRow[]): {
  stage: CountRow[];
  technology: CountRow[];
  nation: CountRow[];
} {
  return {
    stage: countLabels(rows.map((row) => ({ label: row.displayStage }))),
    technology: countLabels(rows.map((row) => ({ label: row.technology }))),
    nation: countLabels(rows.map((row) => ({ label: row.nation }))),
  };
}

export function projectFacets(rows: readonly ProjectIndexRow[]): {
  stages: string[];
  technologies: string[];
  nations: string[];
} {
  return {
    stages: unique(rows.map((row) => row.displayStage).filter((value) => value !== "Unknown")),
    technologies: unique(rows.map((row) => row.technology)),
    nations: unique(rows.map((row) => row.nation)),
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

export function isDefaultProjectQuery(query: ProjectListQuery): boolean {
  return (
    query.q.trim() === "" &&
    query.stage === "all" &&
    query.technology === "all" &&
    query.nation === "all" &&
    query.page === 1
  );
}

export function queryProjectRows(rows: readonly ProjectIndexRow[], query: ProjectListQuery): ProjectListPage {
  const needle = query.q.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (query.stage !== "all" && row.displayStage !== query.stage) {
      return false;
    }
    if (query.technology !== "all" && row.technology !== query.technology) {
      return false;
    }
    if (query.nation !== "all" && row.nation !== query.nation) {
      return false;
    }
    if (needle.length === 0) {
      return true;
    }
    return `${row.name} ${row.technology} ${row.displayStage} ${row.planning} ${row.construction} ${row.gate}`
      .toLowerCase()
      .includes(needle);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PROJECT_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const start = (page - 1) * PROJECT_PAGE_SIZE;
  return {
    rows: filtered.slice(start, start + PROJECT_PAGE_SIZE),
    total: filtered.length,
    page,
    pages,
  };
}
