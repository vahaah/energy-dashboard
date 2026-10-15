import { technologyLabel } from "@/lib/assets/labels";
import {
  ASSET_PAGE_SIZE,
  type AssetIndexRow,
  type AssetSort,
} from "@/lib/assets/types";

export type AssetListQuery = {
  q: string;
  technology: AssetIndexRow["technology"] | null;
  status: AssetIndexRow["status"] | null;
  source: AssetIndexRow["source"] | null;
  region: string;
  sort: AssetSort;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type AssetListResult = {
  rows: AssetIndexRow[];
  total: number;
  page: number;
  pages: number;
};

export function foldSearch(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function haystacks(row: AssetIndexRow): { text: string; weight: number }[] {
  return [
    { text: foldSearch(row.name), weight: 8 },
    { text: foldSearch(row.id), weight: 7 },
    { text: foldSearch(row.operator), weight: 6 },
    { text: foldSearch(technologyLabel(row.technology)), weight: 5 },
    { text: foldSearch(row.location), weight: 4 },
    { text: foldSearch(row.region), weight: 4 },
    { text: foldSearch(row.aka), weight: 3 },
    { text: foldSearch(row.source), weight: 2 },
    { text: foldSearch(row.sources.join(" ")), weight: 2 },
  ];
}

function tokenScore(row: AssetIndexRow, token: string): number {
  let best = 0;
  for (const field of haystacks(row)) {
    if (field.text.length === 0) {
      continue;
    }
    if (field.text === token) {
      best = Math.max(best, field.weight * 4);
    } else if (field.text.startsWith(token) || field.text.split(/[^a-z0-9]+/).includes(token)) {
      best = Math.max(best, field.weight * 2);
    } else if (field.text.includes(token)) {
      best = Math.max(best, field.weight);
    }
  }
  return best;
}

export function matchScore(row: AssetIndexRow, query: string): number | null {
  const tokens = foldSearch(query).split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return 0;
  }
  let score = 0;
  for (const token of tokens) {
    const next = tokenScore(row, token);
    if (next === 0) {
      return null;
    }
    score += next;
  }
  return score;
}

export function searchAssets(rows: readonly AssetIndexRow[], query: string, limit: number): AssetIndexRow[] {
  const tokens = foldSearch(query).split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  if (tokens.length === 0 || limit <= 0) {
    return [];
  }
  const hits: { row: AssetIndexRow; score: number }[] = [];
  for (const row of rows) {
    const score = matchScore(row, query);
    if (score !== null && score > 0) {
      hits.push({ row, score });
    }
  }
  hits.sort(
    (left, right) => right.score - left.score || left.row.name.localeCompare(right.row.name, "en") || left.row.id.localeCompare(right.row.id),
  );
  return hits.slice(0, limit).map((hit) => hit.row);
}

function compareRows(left: AssetIndexRow, right: AssetIndexRow, sort: AssetSort, dir: "asc" | "desc"): number {
  const sign = dir === "asc" ? 1 : -1;
  switch (sort) {
    case "name":
      return left.name.localeCompare(right.name, "en") * sign || left.id.localeCompare(right.id);
    case "technology":
      return (
        technologyLabel(left.technology).localeCompare(technologyLabel(right.technology), "en") * sign ||
        left.name.localeCompare(right.name, "en")
      );
    case "status":
      return left.status.localeCompare(right.status) * sign || left.name.localeCompare(right.name, "en");
    case "region":
      return left.region.localeCompare(right.region, "en") * sign || left.name.localeCompare(right.name, "en");
    case "source":
      return left.source.localeCompare(right.source) * sign || left.name.localeCompare(right.name, "en");
    case "mw": {
      if (left.mw === null && right.mw === null) {
        return left.name.localeCompare(right.name, "en");
      }
      if (left.mw === null) {
        return 1;
      }
      if (right.mw === null) {
        return -1;
      }
      return (left.mw - right.mw) * sign || left.name.localeCompare(right.name, "en");
    }
    default: {
      const neverSort: never = sort;
      return neverSort;
    }
  }
}

export function matchingAssets(rows: readonly AssetIndexRow[], query: AssetListQuery): AssetIndexRow[] {
  const filtered = rows.filter((row) => {
    if (query.technology && row.technology !== query.technology) {
      return false;
    }
    if (query.status && row.status !== query.status) {
      return false;
    }
    if (query.source && !row.sources.includes(query.source)) {
      return false;
    }
    if (query.region && row.region !== query.region) {
      return false;
    }
    return matchScore(row, query.q) !== null;
  });
  return filtered.slice().sort((left, right) => compareRows(left, right, query.sort, query.dir));
}

export function queryAssets(rows: readonly AssetIndexRow[], query: AssetListQuery): AssetListResult {
  const sorted = matchingAssets(rows, query);
  const pageSize = query.pageSize > 0 ? query.pageSize : ASSET_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, query.page), pages);
  const start = (page - 1) * pageSize;
  return {
    rows: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
    pages,
  };
}

export type ComboboxMotion =
  | { type: "open"; index: number }
  | { type: "close" }
  | { type: "move"; index: number }
  | { type: "select"; index: number }
  | { type: "none" };

export function comboboxKeyMotion(input: {
  key: string;
  open: boolean;
  index: number;
  length: number;
}): ComboboxMotion {
  const { key, open, index, length } = input;
  if (!open) {
    if (key === "ArrowDown" && length > 0) {
      return { type: "open", index: 0 };
    }
    if (key === "ArrowUp" && length > 0) {
      return { type: "open", index: length - 1 };
    }
    return { type: "none" };
  }
  if (length <= 0) {
    if (key === "Escape") {
      return { type: "close" };
    }
    return { type: "none" };
  }
  switch (key) {
    case "ArrowDown":
      return { type: "move", index: (index + 1) % length };
    case "ArrowUp":
      return { type: "move", index: (index - 1 + length) % length };
    case "Home":
      return { type: "move", index: 0 };
    case "End":
      return { type: "move", index: length - 1 };
    case "Enter":
      return { type: "select", index };
    case "Escape":
      return { type: "close" };
    default:
      return { type: "none" };
  }
}
