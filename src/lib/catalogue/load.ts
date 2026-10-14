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

export type LoadedCatalogue = {
  sources: ParseResult<CatalogueSource[]>;
  datasets: ParseResult<CatalogueDataset[]>;
  releases: ParseResult<SourceRelease[]>;
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

export function parseNdjson(text: string, file: string): ParseResult<unknown[]> {
  const records: unknown[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.length === 0) {
      continue;
    }
    try {
      records.push(JSON.parse(line) as unknown);
    } catch {
      return { ok: false, errors: [`${file}:${index + 1}: invalid JSON`] };
    }
  }
  return { ok: true, data: records };
}

function parseNdjsonFile<T>(filePath: string, itemSchema: z.ZodType<T>): ParseResult<T[]> {
  const text = readText(filePath);
  if (!text.ok) {
    return text;
  }
  const file = basename(filePath);
  const lines = parseNdjson(text.data, file);
  if (!lines.ok) {
    return lines;
  }
  const records: T[] = [];
  const errors: string[] = [];
  for (let index = 0; index < lines.data.length; index += 1) {
    const parsed = itemSchema.safeParse(lines.data[index]);
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

export function loadCatalogue(dir: string): LoadedCatalogue {
  return {
    sources: parseJsonFile(join(dir, CATALOGUE_FILES.sources), sourcesFileSchema),
    datasets: parseJsonFile(join(dir, CATALOGUE_FILES.datasets), datasetsFileSchema),
    releases: parseNdjsonFile(join(dir, CATALOGUE_FILES.releases), sourceReleaseSchema),
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
