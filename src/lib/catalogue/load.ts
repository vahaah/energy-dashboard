import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import {
  CATALOGUE_FILES,
  datasetsFileSchema,
  ingestionRunSchema,
  sourceReleaseSchema,
  sourcesFileSchema,
  type CatalogueDataset,
  type CatalogueSource,
  type IngestionRun,
  type SourceRelease,
} from "@/lib/catalogue/schema";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

/** Parsed release plus the committed NDJSON line, without the line break. */
export type CatalogueReleaseLine = {
  release: SourceRelease;
  line: string;
};

export type LoadedCatalogue = {
  sources: ParseResult<CatalogueSource[]>;
  datasets: ParseResult<CatalogueDataset[]>;
  releases: ParseResult<CatalogueReleaseLine[]>;
  runs: ParseResult<IngestionRun[]>;
};

function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${file}: ${path}: ${issue.message}`;
  });
}

function readText(filePath: string): ParseResult<string> {
  try {
    return { ok: true, data: readFileSync(filePath, "utf8") };
  } catch {
    return { ok: false, errors: [`missing ${basename(filePath)}`] };
  }
}

function parseJsonFile<T>(filePath: string, schema: z.ZodType<T>): ParseResult<T> {
  const text = readText(filePath);
  if (!text.ok) {
    return text;
  }
  const file = basename(filePath);
  let json: unknown;
  try {
    json = JSON.parse(text.data) as unknown;
  } catch {
    return { ok: false, errors: [`${file}: invalid JSON`] };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, errors: formatIssues(file, parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

type NdjsonEntry = { line: string; value: unknown };

/** Keep the committed line. A later trim would hide a reordered or padded record. */
export function parseNdjsonEntries(text: string, file: string): ParseResult<NdjsonEntry[]> {
  const records: NdjsonEntry[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      continue;
    }
    try {
      records.push({ line, value: JSON.parse(line) as unknown });
    } catch {
      return { ok: false, errors: [`${file}:${index + 1}: invalid JSON`] };
    }
  }
  return { ok: true, data: records };
}

export function parseNdjson(text: string, file: string): ParseResult<unknown[]> {
  const entries = parseNdjsonEntries(text, file);
  if (!entries.ok) {
    return entries;
  }
  return { ok: true, data: entries.data.map((entry) => entry.value) };
}

function parseNdjsonFile<T>(filePath: string, itemSchema: z.ZodType<T>): ParseResult<T[]> {
  const text = readText(filePath);
  if (!text.ok) {
    return text;
  }
  const file = basename(filePath);
  const lines = parseNdjsonEntries(text.data, file);
  if (!lines.ok) {
    return lines;
  }
  const records: T[] = [];
  const errors: string[] = [];
  for (let index = 0; index < lines.data.length; index += 1) {
    const parsed = itemSchema.safeParse(lines.data[index]?.value);
    if (!parsed.success) {
      for (const issue of formatIssues(file, parsed.error)) {
        errors.push(issue.replace(`${file}: `, `${file}:${index + 1}: `));
      }
      continue;
    }
    records.push(parsed.data);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data: records };
}

function parseReleaseFile(filePath: string): ParseResult<CatalogueReleaseLine[]> {
  const text = readText(filePath);
  if (!text.ok) {
    return text;
  }
  const file = basename(filePath);
  const lines = parseNdjsonEntries(text.data, file);
  if (!lines.ok) {
    return lines;
  }
  const records: CatalogueReleaseLine[] = [];
  const errors: string[] = [];
  for (let index = 0; index < lines.data.length; index += 1) {
    const entry = lines.data[index];
    if (!entry) {
      continue;
    }
    const parsed = sourceReleaseSchema.safeParse(entry.value);
    if (!parsed.success) {
      for (const issue of formatIssues(file, parsed.error)) {
        errors.push(issue.replace(`${file}: `, `${file}:${index + 1}: `));
      }
      continue;
    }
    records.push({ release: parsed.data, line: entry.line });
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, data: records };
}

export function loadCatalogue(dir: string): LoadedCatalogue {
  return {
    sources: parseJsonFile(join(dir, CATALOGUE_FILES.sources), sourcesFileSchema),
    datasets: parseJsonFile(join(dir, CATALOGUE_FILES.datasets), datasetsFileSchema),
    releases: parseReleaseFile(join(dir, CATALOGUE_FILES.releases)),
    runs: parseNdjsonFile(join(dir, CATALOGUE_FILES.runs), ingestionRunSchema),
  };
}

export function catalogueErrors(loaded: LoadedCatalogue): string[] {
  const errors: string[] = [];
  if (!loaded.sources.ok) {
    errors.push(...loaded.sources.errors);
  }
  if (!loaded.datasets.ok) {
    errors.push(...loaded.datasets.errors);
  }
  if (!loaded.releases.ok) {
    errors.push(...loaded.releases.errors);
  }
  if (!loaded.runs.ok) {
    errors.push(...loaded.runs.errors);
  }
  return errors;
}
