import { cleanCountry, cleanName, parseCsv, parseNumber } from "@/lib/catalogue/assets/parse";
import {
  STORAGE_REPD_RELEASE_ID,
  storageRecordId,
  type GbCountry,
  type StorageRecord,
  type StorageStatus,
  type StorageTechnology,
} from "@/lib/storage/records";

const TECHNOLOGY: Record<string, StorageTechnology> = {
  Battery: "battery",
  "Pumped Storage Hydroelectricity": "pumped_storage",
};

function column(header: string[], name: string): number {
  const index = header.findIndex((cell) => cell.trim() === name);
  if (index < 0) {
    throw new Error(`REPD column missing: ${name}`);
  }
  return index;
}

function statusOf(value: string): StorageStatus {
  return value.replace(/\u00a0/g, " ").trim().toLowerCase() === "operational" ? "operational" : "not_operating";
}

function countryOf(value: string): GbCountry | null {
  const cleaned = cleanCountry(value);
  if (cleaned === "England" || cleaned === "Scotland" || cleaned === "Wales") {
    return cleaned;
  }
  return null;
}

function colocatedRef(value: string, externalRef: string): string | null {
  const cleaned = value.replace(/\u00a0/g, " ").trim();
  if (cleaned.length === 0 || cleaned.toLowerCase() === "na" || cleaned === externalRef) {
    return null;
  }
  return cleaned;
}

/** Battery and pumped-storage rows from a REPD extract. Other technologies are ignored. */
export function parseRepdStorage(text: string, sourceReleaseId = STORAGE_REPD_RELEASE_ID): StorageRecord[] {
  const table = parseCsv(text);
  const header = table[0];
  if (!header) {
    throw new Error("REPD extract is empty");
  }
  const refIndex = column(header, "Ref ID");
  const nameIndex = column(header, "Site Name");
  const technologyIndex = column(header, "Technology Type");
  const capacityIndex = column(header, "Installed Capacity (MWelec)");
  const statusIndex = column(header, "Development Status (short)");
  const countryIndex = column(header, "Country");
  const coloIndex = column(header, "Storage Co-location REPD Ref ID");
  const records: StorageRecord[] = [];
  for (const row of table.slice(1)) {
    const technology = TECHNOLOGY[(row[technologyIndex] ?? "").trim()];
    if (!technology) {
      continue;
    }
    const externalRef = (row[refIndex] ?? "").trim();
    if (externalRef.length === 0) {
      throw new Error("REPD storage row has no Ref ID");
    }
    const country = countryOf(row[countryIndex] ?? "");
    if (!country) {
      continue;
    }
    const name = cleanName(row[nameIndex] ?? "") || externalRef;
    records.push({
      record_id: storageRecordId(externalRef),
      source_id: "desnz-repd",
      source_release_id: sourceReleaseId,
      external_ref: externalRef,
      name,
      technology,
      status: statusOf(row[statusIndex] ?? ""),
      country,
      rated_mw: parseNumber(row[capacityIndex]),
      energy_mwh: null,
      colocated_ref: colocatedRef(row[coloIndex] ?? "", externalRef),
    });
  }
  return records;
}
