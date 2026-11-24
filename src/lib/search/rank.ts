import { foldSearch } from "@/lib/assets/query";

export type CatalogueGroup = "Projects" | "Assets";

export type CatalogueHit = {
  title: string;
  group: CatalogueGroup;
};

/** Higher means the title is a closer match for the query. */
export function nameStrength(query: string, title: string): number {
  const needle = foldSearch(query).trim();
  const name = foldSearch(title);
  if (needle.length === 0 || name.length === 0) {
    return 0;
  }
  if (name === needle) {
    return 5;
  }
  if (name.startsWith(needle)) {
    return 4;
  }
  const tokens = needle.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  const words = name.split(/[^a-z0-9]+/);
  if (tokens.length > 0 && tokens.every((token, index) => words[index] === token)) {
    return 3;
  }
  if (tokens.length > 0 && tokens.every((token) => words.includes(token))) {
    return 2;
  }
  if (name.includes(needle)) {
    return 1;
  }
  return 0;
}

/** Operating stations win a tie with a same-named planning project. */
export function compareCatalogueHits(query: string, left: CatalogueHit, right: CatalogueHit): number {
  const strength = nameStrength(query, right.title) - nameStrength(query, left.title);
  if (strength !== 0) {
    return strength;
  }
  if (left.group !== right.group) {
    return left.group === "Assets" ? -1 : 1;
  }
  return left.title.localeCompare(right.title, "en");
}
