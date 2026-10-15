/**
 * Write data/catalogue/storage_records.ndjson from a REPD CSV.
 *
 *   npx tsx scripts/catalogue/storage-records.ts data/catalogue/raw/repd.csv
 *
 * Operational pumped-storage refs already in source_entity_mappings are omitted.
 * Those stations stay on the plant register, where the counted DUKES megawatts win.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseNdjson } from "../../src/lib/catalogue/load";
import { mappingRecordSchema } from "../../src/lib/catalogue/assets/record-schema";
import { parseRepdStorage } from "../../src/lib/storage/repd";
import { STORAGE_FILE } from "../../src/lib/storage/records";

const csvPath = process.argv[2];
if (!csvPath) {
  throw new Error("pass the REPD CSV path");
}

const mappings = parseNdjson(
  readFileSync(resolve("data/catalogue/source_entity_mappings.ndjson"), "utf8"),
  "source_entity_mappings.ndjson",
);
if (!mappings.ok) {
  throw new Error(mappings.errors.join("\n"));
}
const mapped = new Set(
  mappings.data
    .map((value) => mappingRecordSchema.parse(value))
    .filter((row) => row.scheme === "REPD_REF")
    .map((row) => row.source_entity_id),
);

const text = readFileSync(resolve(csvPath), "latin1");
const records = parseRepdStorage(text)
  .filter((record) => !mapped.has(record.external_ref))
  .sort((left, right) => left.external_ref.localeCompare(right.external_ref, "en", { numeric: true }));

const lines = records.map((record) => JSON.stringify(record));
const destination = resolve("data/catalogue", STORAGE_FILE);
writeFileSync(destination, `${lines.join("\n")}\n`);
console.log(`${records.length} storage records -> ${destination}`);
