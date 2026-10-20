import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assetPath } from "@/lib/assets/href";
import { parseNdjson } from "@/lib/catalogue/load";
import { assetRecordSchema, mappingRecordSchema } from "@/lib/catalogue/assets/record-schema";
import { formatLondonDayMonthYear } from "@/lib/london-time";
import { buildPipelineFigures, type PipelineFigures } from "@/lib/pipeline/model";
import {
  pipelineEditionSchema,
  pipelineRecordSchema,
  REPD_PIPELINE_EDITION_FILE,
  REPD_PIPELINE_FILE,
  type PipelineEdition,
  type PipelineRecord,
} from "@/lib/pipeline/records";

export type PipelineCatalogue = {
  edition: PipelineEdition;
  records: PipelineRecord[];
  figures: PipelineFigures;
  stamp: string;
};

let cached: PipelineCatalogue | null = null;

function catalogueDir(cwd: string): string {
  return join(cwd, "data", "catalogue");
}

export function pipelineEditionStamp(edition: PipelineEdition): string {
  const label = edition.edition === "REPD Q2 2026" ? "July 2026 (Q2)" : edition.edition;
  return `${label}. Published ${formatLondonDayMonthYear(edition.edition_day)}.`;
}

function readRecords(dir: string): PipelineRecord[] {
  const parsed = parseNdjson(readFileSync(join(dir, REPD_PIPELINE_FILE), "utf8"), REPD_PIPELINE_FILE);
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("\n"));
  }
  return parsed.data.map((value) => pipelineRecordSchema.parse(value));
}

function assetHrefByRef(dir: string): Map<string, string> {
  const mappings = parseNdjson(readFileSync(join(dir, "source_entity_mappings.ndjson"), "utf8"), "source_entity_mappings.ndjson");
  const assets = parseNdjson(readFileSync(join(dir, "assets.ndjson"), "utf8"), "assets.ndjson");
  if (!mappings.ok || !assets.ok) {
    throw new Error([...(mappings.ok ? [] : mappings.errors), ...(assets.ok ? [] : assets.errors)].join("\n"));
  }
  const names = new Map<string, string>();
  for (const value of assets.data) {
    const asset = assetRecordSchema.parse(value);
    names.set(asset.asset_id, asset.name);
  }
  const hrefs = new Map<string, string>();
  for (const value of mappings.data) {
    const mapping = mappingRecordSchema.parse(value);
    if (mapping.scheme !== "REPD_REF") {
      continue;
    }
    const name = names.get(mapping.asset_id);
    if (!name || hrefs.has(mapping.source_entity_id)) {
      continue;
    }
    hrefs.set(mapping.source_entity_id, assetPath(mapping.asset_id, name));
  }
  return hrefs;
}

export function loadPipelineCatalogue(cwd = process.cwd()): PipelineCatalogue {
  if (cached && cwd === process.cwd()) {
    return cached;
  }
  const dir = catalogueDir(cwd);
  const edition = pipelineEditionSchema.parse(JSON.parse(readFileSync(join(dir, REPD_PIPELINE_EDITION_FILE), "utf8")));
  const records = readRecords(dir);
  if (records.length !== edition.row_count) {
    throw new Error(`REPD pipeline row count ${records.length} does not match the edition file`);
  }
  const hrefs = assetHrefByRef(dir);
  const figures = buildPipelineFigures(records, (ref) => hrefs.get(ref) ?? null);
  const catalogue = { edition, records, figures, stamp: pipelineEditionStamp(edition) };
  if (cwd === process.cwd()) {
    cached = catalogue;
  }
  return catalogue;
}

export function resetPipelineCatalogueForTests(): void {
  cached = null;
}
