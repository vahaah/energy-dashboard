import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNdjson } from "@/lib/catalogue/load";
import { STORAGE_FILE, storageRecordId, storageRecordSchema } from "@/lib/storage/records";

const MW_MAX = 5_000;
const ENERGY_MAX = 200_000;

export function checkStorageRecords(
  dir: string,
  options: { required: boolean; releaseIds: ReadonlySet<string> },
): string[] {
  const path = join(dir, STORAGE_FILE);
  if (!existsSync(path)) {
    return options.required ? [`missing ${STORAGE_FILE}`] : [];
  }
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [`missing ${STORAGE_FILE}`];
  }
  const parsed = parseNdjson(text, STORAGE_FILE);
  if (!parsed.ok) {
    return parsed.errors;
  }
  const errors: string[] = [];
  const ids = new Set<string>();
  const refs = new Set<string>();
  for (const value of parsed.data) {
    const record = storageRecordSchema.safeParse(value);
    if (!record.success) {
      errors.push(
        `${STORAGE_FILE}: ${record.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      );
      continue;
    }
    const row = record.data;
    if (ids.has(row.record_id)) {
      errors.push(`${STORAGE_FILE}: duplicate record ${row.record_id}`);
    }
    ids.add(row.record_id);
    const expected = storageRecordId(row.external_ref);
    if (row.record_id !== expected) {
      errors.push(`${STORAGE_FILE}: ${row.external_ref} id is not ${expected}`);
    }
    if (refs.has(row.external_ref)) {
      errors.push(`${STORAGE_FILE}: duplicate REPD ref ${row.external_ref}`);
    }
    refs.add(row.external_ref);
    if (row.colocated_ref === row.external_ref) {
      errors.push(`${STORAGE_FILE}: ${row.external_ref} co-locates with itself`);
    }
    if (row.rated_mw !== null && (row.rated_mw < 0 || row.rated_mw > MW_MAX)) {
      errors.push(`${STORAGE_FILE}: ${row.external_ref} rated capacity is outside 0..${MW_MAX}`);
    }
    if (row.energy_mwh !== null && (row.energy_mwh <= 0 || row.energy_mwh > ENERGY_MAX)) {
      errors.push(`${STORAGE_FILE}: ${row.external_ref} energy capacity is outside 0..${ENERGY_MAX}`);
    }
    if (!options.releaseIds.has(row.source_release_id)) {
      errors.push(`${STORAGE_FILE}: ${row.external_ref} release is not in the catalogue`);
    }
  }
  return errors;
}
