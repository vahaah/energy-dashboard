import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assetRecordSchema, capacityRecordSchema, mappingRecordSchema, projectRecordSchema } from "@/lib/catalogue/assets/record-schema";
import { currentCapacityRecords } from "@/lib/catalogue/assets/releases";
import { parseNdjson } from "@/lib/catalogue/load";
import { sourceReleaseSchema } from "@/lib/catalogue/schema";
import type { StorageInput } from "@/lib/storage/inventory";
import { buildStorageInventory, storageInputFromRecord, type StorageInventory } from "@/lib/storage/inventory";
import { STORAGE_FILE, storageRecordSchema, type StorageRecord } from "@/lib/storage/records";
import { getHeadlineGenerationQueryParams } from "@/lib/dashboard-data";
import type { Generation5min } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

function readNdjson<T>(file: string, text: string, parse: (value: unknown) => T): T[] {
  const parsed = parseNdjson(text, file);
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("\n"));
  }
  return parsed.data.map((value) => parse(value));
}

export function readStorageInputs(root = process.cwd()): StorageInput[] {
  const catalogue = join(root, "data", "catalogue");
  const read = (name: string) => readFileSync(join(catalogue, name), "utf8");
  const assets = readNdjson("assets.ndjson", read("assets.ndjson"), (value) => assetRecordSchema.parse(value));
  const projects = readNdjson("projects.ndjson", read("projects.ndjson"), (value) => projectRecordSchema.parse(value));
  const capacity = readNdjson("capacity_records.ndjson", read("capacity_records.ndjson"), (value) =>
    capacityRecordSchema.parse(value),
  );
  const mappings = readNdjson("source_entity_mappings.ndjson", read("source_entity_mappings.ndjson"), (value) =>
    mappingRecordSchema.parse(value),
  );
  const releases = readNdjson("source_releases.ndjson", read("source_releases.ndjson"), (value) =>
    sourceReleaseSchema.parse(value),
  );
  const records = readNdjson(STORAGE_FILE, read(STORAGE_FILE), (value) => storageRecordSchema.parse(value));
  const pumped = new Set(
    assets.filter((asset) => asset.technology === "pumped_storage").map((asset) => asset.asset_id),
  );
  const projectsById = new Map(projects.map((project) => [project.project_id, project]));
  const assetsById = new Map(assets.map((asset) => [asset.asset_id, asset]));
  const current = currentCapacityRecords(
    capacity.filter((record) => pumped.has(record.asset_id)),
    releases,
  );
  const inputs: StorageInput[] = [];
  for (const record of current) {
    const asset = assetsById.get(record.asset_id);
    const project = projectsById.get(record.project_id);
    if (!asset || asset.technology !== "pumped_storage" || !project) {
      continue;
    }
    inputs.push({
      id: record.capacity_record_id,
      name: asset.name,
      technology: "pumped_storage",
      status: asset.status,
      country: asset.country ?? "",
      ratedMw: record.mw,
      energyMwh: null,
      externalRef: project.external_ref,
      colocatedRef: null,
      assetId: asset.asset_id,
      counts: record.counts,
    });
  }
  const mappedRefs = new Set(
    mappings.filter((mapping) => mapping.scheme === "REPD_REF").map((mapping) => mapping.source_entity_id),
  );
  for (const record of records) {
    if (mappedRefs.has(record.external_ref)) {
      continue;
    }
    inputs.push(storageInputFromRecord(record));
  }
  return inputs;
}

export function loadStorageInventory(root = process.cwd(), coveredIds: ReadonlySet<string> = new Set()): StorageInventory {
  return buildStorageInventory(readStorageInputs(root), coveredIds);
}

export function readStorageRecords(root = process.cwd()): StorageRecord[] {
  const text = readFileSync(join(root, "data", "catalogue", STORAGE_FILE), "utf8");
  return readNdjson(STORAGE_FILE, text, (value) => storageRecordSchema.parse(value));
}

/** Warmed 24h FUELINST envelope. A miss returns null and does not call Tinybird. */
export async function loadWarmedStorageGeneration(now: Date): Promise<Generation5min[] | null> {
  return peekWarmedPipe<Generation5min>("generation_5min_range", getHeadlineGenerationQueryParams(now), {
    range: "24h",
    now,
  });
}
