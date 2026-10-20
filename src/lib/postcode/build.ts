import { locate, type IndexedFeature } from "@/lib/postcode/geometry";
import { normalizePostcode } from "@/lib/postcode/parse";
import type { PostcodeRow } from "@/lib/postcode/rows";

/** England, Wales, Scotland. Northern Ireland (N92000002) stays out. */
export const GB_COUNTRY_CODES = new Set(["E92000001", "W92000004", "S92000003"]);

export type BuildStats = {
  current: number;
  terminated: number;
  omitted: number;
  duplicates: number;
  quarantined: number;
  dnoOverlaps: number;
  ciOverlaps: number;
  unlocated: number;
  unnamed: number;
};

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char ?? "";
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char ?? "";
  }
  cells.push(current);
  return cells;
}

function headerIndex(headers: readonly string[], patterns: readonly RegExp[]): number {
  let best = -1;
  let bestRank = -1;
  headers.forEach((header, index) => {
    const label = header.replace(/^\uFEFF/, "").trim().toLowerCase();
    if (!patterns.some((pattern) => pattern.test(label))) {
      return;
    }
    const digits = /\d+/.exec(label)?.[0];
    const rank = digits ? Number(digits) : 0;
    if (rank >= bestRank) {
      bestRank = rank;
      best = index;
    }
  });
  return best;
}

function requireColumn(headers: readonly string[], name: string, patterns: readonly RegExp[]): number {
  const index = headerIndex(headers, patterns);
  if (index < 0) {
    throw new Error(`NSPL file is missing ${name}`);
  }
  return index;
}

export function parseAuthorityNames(csv: string): Map<string, string> {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = parseCsvLine(lines[0] ?? "");
  const code = requireColumn(header, "authority code", [/^lad\d*cd$/, /^laua$/]);
  const name = requireColumn(header, "authority name", [/^lad\d*nm$/, /^ladnm$/, /^la_name$/]);
  const names = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const id = cells[code]?.trim() ?? "";
    const label = cells[name]?.trim() ?? "";
    if (id && label) {
      names.set(id, label);
    }
  }
  return names;
}

function terminationOf(value: string): "current" | "terminated" | "quarantine" {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") {
    return "current";
  }
  return /^\d{6}$/.test(trimmed) ? "terminated" : "quarantine";
}

function coordinate(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export type BuildLookupInput = {
  postcodeLines: AsyncIterable<string>;
  authorityNamesCsv: string;
  dno: readonly IndexedFeature[];
  ci: readonly IndexedFeature[];
  keepRows?: boolean;
};

/**
 * Local authority is the NSPL column. DNO and Carbon Intensity are separate
 * point-in-polygon hits. A row with no coordinate keeps the authority and
 * leaves the other two empty.
 */
export async function buildPostcodeLookup(input: BuildLookupInput): Promise<{
  rows: Map<string, PostcodeRow>;
  stats: BuildStats;
}> {
  const names = parseAuthorityNames(input.authorityNamesCsv);
  const rows = new Map<string, PostcodeRow>();
  const seen = new Set<string>();
  const stats: BuildStats = {
    current: 0,
    terminated: 0,
    omitted: 0,
    duplicates: 0,
    quarantined: 0,
    dnoOverlaps: 0,
    ciOverlaps: 0,
    unlocated: 0,
    unnamed: 0,
  };
  let columns: {
    postcode: number;
    term: number;
    la: number;
    country: number;
    lat: number;
    lon: number;
  } | null = null;

  for await (const rawLine of input.postcodeLines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "") {
      continue;
    }
    const cells = parseCsvLine(line);
    if (!columns) {
      columns = {
        postcode: requireColumn(cells, "pcds", [/^pcds$/]),
        term: requireColumn(cells, "doterm", [/^doterm$/]),
        la: requireColumn(cells, "local authority", [/^lad\d*cd$/, /^laua$/]),
        country: requireColumn(cells, "country", [/^ctry\d*cd$/, /^ctry$/]),
        lat: requireColumn(cells, "lat", [/^lat$/]),
        lon: requireColumn(cells, "long", [/^long$/]),
      };
      continue;
    }

    const parsed = normalizePostcode(cells[columns.postcode] ?? "");
    if (!parsed) {
      stats.quarantined += 1;
      continue;
    }
    if (seen.has(parsed.normalised)) {
      stats.duplicates += 1;
      continue;
    }
    if (parsed.outward.startsWith("BT") || !GB_COUNTRY_CODES.has((cells[columns.country] ?? "").trim())) {
      stats.omitted += 1;
      seen.add(parsed.normalised);
      continue;
    }
    const termination = terminationOf(cells[columns.term] ?? "");
    if (termination === "quarantine") {
      stats.quarantined += 1;
      seen.add(parsed.normalised);
      continue;
    }
    const laCode = (cells[columns.la] ?? "").trim();
    if (!laCode) {
      stats.quarantined += 1;
      seen.add(parsed.normalised);
      continue;
    }
    const laName = names.get(laCode);
    if (!laName) {
      stats.unnamed += 1;
    }
    const row: PostcodeRow = {
      la: { code: laCode, name: laName ?? laCode },
      dno: null,
      ci: null,
      terminated: termination === "terminated",
    };
    if (!row.terminated) {
      const latitude = coordinate(cells[columns.lat] ?? "");
      const longitude = coordinate(cells[columns.lon] ?? "");
      if (latitude == null || longitude == null || (latitude === 0 && longitude === 0)) {
        stats.unlocated += 1;
      } else {
        const dnoHit = locate(input.dno, longitude, latitude);
        const ciHit = locate(input.ci, longitude, latitude);
        if (dnoHit.kind === "overlap") {
          stats.dnoOverlaps += 1;
        } else if (dnoHit.kind === "one") {
          row.dno = { id: dnoHit.feature.id, name: dnoHit.feature.name };
        } else {
          stats.unlocated += 1;
        }
        if (ciHit.kind === "overlap") {
          stats.ciOverlaps += 1;
        } else if (ciHit.kind === "one") {
          const id = Number(ciHit.feature.id);
          row.ci = Number.isInteger(id) ? { id, name: ciHit.feature.name } : null;
        }
      }
      stats.current += 1;
    } else {
      stats.terminated += 1;
    }

    seen.add(parsed.normalised);
    if (input.keepRows !== false) {
      rows.set(parsed.normalised, row);
    }
  }

  if (!columns) {
    throw new Error("NSPL file is missing pcds");
  }
  if (stats.current + stats.terminated === 0) {
    throw new Error("NSPL file has no GB postcodes");
  }
  return { rows, stats };
}
