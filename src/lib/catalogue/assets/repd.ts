import { cleanCountry, cleanName, parseCsv, parseNumber } from "@/lib/catalogue/assets/parse";
import { REPD_SOURCE_ID, repdTechnology } from "@/lib/catalogue/assets/technologies";
import type { CatalogueStation } from "@/lib/catalogue/assets/types";

export type RepdParseStats = {
  rows: number;
  operationalRows: number;
  imported: number;
  skippedStorage: number;
  missingCoordinates: number;
};

function column(header: string[], name: string): number {
  const index = header.findIndex((cell) => cell.trim() === name);
  if (index < 0) {
    throw new Error(`REPD column missing: ${name}`);
  }
  return index;
}

function isOperational(status: string): boolean {
  return status.replace(/\u00a0/g, " ").trim().toLowerCase() === "operational";
}

export function parseRepdCsv(text: string): { stations: CatalogueStation[]; stats: RepdParseStats } {
  const table = parseCsv(text);
  const header = table[0];
  if (!header) {
    throw new Error("REPD extract is empty");
  }
  const refIndex = column(header, "Ref ID");
  const nameIndex = column(header, "Site Name");
  const technologyIndex = column(header, "Technology Type");
  const capacityIndex = column(header, "Installed Capacity (MWelec)");
  const statusIndex = column(header, "Development Status");
  const countryIndex = column(header, "Country");
  const eastingIndex = column(header, "X-coordinate");
  const northingIndex = column(header, "Y-coordinate");
  const stations: CatalogueStation[] = [];
  let operationalRows = 0;
  let skippedStorage = 0;
  let missingCoordinates = 0;
  for (const row of table.slice(1)) {
    if (!isOperational(row[statusIndex] ?? "")) {
      continue;
    }
    operationalRows += 1;
    const technology = repdTechnology(row[technologyIndex] ?? "");
    if (technology === "skip") {
      skippedStorage += 1;
      continue;
    }
    const externalRef = (row[refIndex] ?? "").trim();
    if (externalRef.length === 0) {
      throw new Error("REPD operational row has no Ref ID");
    }
    const easting = parseNumber(row[eastingIndex]);
    const northing = parseNumber(row[northingIndex]);
    if (easting === null || northing === null || (easting === 0 && northing === 0)) {
      missingCoordinates += 1;
    }
    stations.push({
      sourceId: REPD_SOURCE_ID,
      externalRef,
      name: cleanName(row[nameIndex] ?? "") || externalRef,
      technology,
      country: cleanCountry(row[countryIndex] ?? null),
      easting: easting === 0 && northing === 0 ? null : easting,
      northing: easting === 0 && northing === 0 ? null : northing,
      mw: parseNumber(row[capacityIndex]),
    });
  }
  return {
    stations,
    stats: {
      rows: table.length - 1,
      operationalRows,
      imported: stations.length,
      skippedStorage,
      missingCoordinates,
    },
  };
}
