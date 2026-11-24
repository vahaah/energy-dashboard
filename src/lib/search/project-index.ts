import { foldSearch } from "@/lib/assets/query";
import { fetchBoundedJson } from "@/lib/http/bounded-json";
import { projectPath } from "@/lib/search/project-href";

export const PROJECT_INDEX_VERSION = 1;
export const PROJECT_INDEX_PATH = "/search/projects.json";

export type ProjectSearchRow = {
  id: string;
  name: string;
  technology: string;
  stage: string;
  place: string;
  mw: number | null;
};

type CompactRow = [string, string, string, string, string, number | null];

const PROJECT_ID = /^epj_[a-f0-9]{16}$/;

export function encodeProjectIndex(rows: readonly ProjectSearchRow[]): string {
  const file = {
    version: PROJECT_INDEX_VERSION,
    rows: rows.map(
      (row) => [row.id, row.name, row.technology, row.stage, row.place, row.mw] satisfies CompactRow,
    ),
  };
  return `${JSON.stringify(file)}\n`;
}

export function decodeProjectIndex(value: unknown): ProjectSearchRow[] {
  if (!value || typeof value !== "object") {
    throw new Error("project index is not an object");
  }
  const version = (value as { version?: unknown }).version;
  const rows = (value as { rows?: unknown }).rows;
  if (version !== PROJECT_INDEX_VERSION || !Array.isArray(rows)) {
    throw new Error("project index version is not supported");
  }
  return rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 6) {
      throw new Error("project index row is the wrong shape");
    }
    const [id, name, technology, stage, place, mw] = row;
    if (
      typeof id !== "string" ||
      !PROJECT_ID.test(id) ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof technology !== "string" ||
      typeof stage !== "string" ||
      typeof place !== "string" ||
      (mw !== null && (typeof mw !== "number" || !Number.isFinite(mw)))
    ) {
      throw new Error(`project index row ${String(id)} is invalid`);
    }
    return { id, name, technology, stage, place, mw };
  });
}

export function projectSearchHref(row: Pick<ProjectSearchRow, "id" | "name">): string {
  return projectPath(row.id, row.name);
}

function fieldScore(text: string, token: string, weight: number): number {
  if (text.length === 0) {
    return 0;
  }
  if (text === token) {
    return weight * 4;
  }
  if (text.startsWith(token) || text.split(/[^a-z0-9]+/).includes(token)) {
    return weight * 2;
  }
  if (text.includes(token)) {
    return weight;
  }
  return 0;
}

export function searchProjects(rows: readonly ProjectSearchRow[], query: string, limit: number): ProjectSearchRow[] {
  const tokens = foldSearch(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0 || limit <= 0) {
    return [];
  }
  const hits: { row: ProjectSearchRow; score: number }[] = [];
  for (const row of rows) {
    const fields = [
      { text: foldSearch(row.name), weight: 8 },
      { text: foldSearch(row.id), weight: 6 },
      { text: foldSearch(row.technology), weight: 4 },
      { text: foldSearch(row.stage), weight: 3 },
      { text: foldSearch(row.place), weight: 2 },
    ];
    let score = 0;
    let matched = true;
    for (const token of tokens) {
      let best = 0;
      for (const field of fields) {
        best = Math.max(best, fieldScore(field.text, token, field.weight));
      }
      if (best === 0) {
        matched = false;
        break;
      }
      score += best;
    }
    if (matched) {
      hits.push({ row, score });
    }
  }
  hits.sort(
    (left, right) =>
      right.score - left.score ||
      left.row.name.localeCompare(right.row.name, "en") ||
      left.row.id.localeCompare(right.row.id),
  );
  return hits.slice(0, limit).map((hit) => hit.row);
}

let indexRequest: Promise<ProjectSearchRow[]> | null = null;

export function resetProjectSearchIndexCache(): void {
  indexRequest = null;
}

export function loadProjectSearchIndex(fetchIndex: typeof fetch = fetch): Promise<ProjectSearchRow[]> {
  if (!indexRequest) {
    const pending = fetchBoundedJson(PROJECT_INDEX_PATH, undefined, fetchIndex)
      .then((body) => decodeProjectIndex(body))
      .catch((error: unknown) => {
        if (indexRequest === pending) {
          indexRequest = null;
        }
        throw error;
      });
    indexRequest = pending;
  }
  return indexRequest;
}
