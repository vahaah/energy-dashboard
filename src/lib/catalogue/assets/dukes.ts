import { cleanCountry, cleanName, parseNumber } from "@/lib/catalogue/assets/parse";
import { DUKES_SOURCE_ID, dukesTechnology } from "@/lib/catalogue/assets/technologies";
import type { CatalogueStation } from "@/lib/catalogue/assets/types";

export type DukesHeadline = {
  major_power_producers: number;
  all_generators: number;
};

function textCell(value: unknown): string {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function normalizedHeader(value: unknown): string {
  return textCell(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function column(header: string[], name: string): number {
  const exact = header.findIndex((cell) => cell === name);
  if (exact >= 0) {
    return exact;
  }
  const prefixed = header.findIndex((cell) => cell.startsWith(name));
  if (prefixed >= 0) {
    return prefixed;
  }
  throw new Error(`DUKES 5.11 column missing: ${name}`);
}

export function parseDukesStations(rows: readonly (readonly unknown[])[]): CatalogueStation[] {
  const headerIndex = rows.findIndex((row) => {
    const labels = row.map(normalizedHeader);
    return labels.includes("sitename") && labels.some((label) => label.startsWith("companyname"));
  });
  if (headerIndex < 0) {
    throw new Error("DUKES 5.11 station header was not found");
  }
  const header = (rows[headerIndex] ?? []).map(normalizedHeader);
  const nameIndex = column(header, "sitename");
  const technologyIndex = column(header, "technology");
  const typeIndex = column(header, "type");
  const fuelIndex = column(header, "primaryfuel");
  const capacityIndex = column(header, "installedcapacity");
  const countryIndex = column(header, "country");
  const eastingIndex = column(header, "xcoordinate");
  const northingIndex = column(header, "ycoordinate");
  const codeIndex = column(header, "desnzsitecode");
  const stations: CatalogueStation[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const name = cleanName(textCell(row[nameIndex]));
    const code = textCell(row[codeIndex]);
    if (name.length === 0 && code.length === 0) {
      continue;
    }
    if (code.length === 0) {
      throw new Error(`DUKES station ${name} has no DESNZ site code`);
    }
    const technology = dukesTechnology(
      textCell(row[technologyIndex]),
      textCell(row[typeIndex]),
      textCell(row[fuelIndex]),
    );
    const easting = parseNumber(row[eastingIndex]);
    const northing = parseNumber(row[northingIndex]);
    stations.push({
      sourceId: DUKES_SOURCE_ID,
      externalRef: code,
      name: name || code,
      technology,
      country: cleanCountry(textCell(row[countryIndex]) || null),
      easting: easting === 0 && northing === 0 ? null : easting,
      northing: easting === 0 && northing === 0 ? null : northing,
      mw: parseNumber(row[capacityIndex]),
    });
  }
  if (stations.length === 0) {
    throw new Error("DUKES 5.11 station list is empty");
  }
  return stations;
}

export function parseDukesHeadline(rows: readonly (readonly unknown[])[]): DukesHeadline {
  let major: number | null = null;
  let all: number | null = null;
  for (const row of rows) {
    const generator = textCell(row[0]);
    const fuel = textCell(row[1]);
    const mw = parseNumber(row[2]);
    if (mw === null || fuel.toLowerCase() !== "total") {
      continue;
    }
    if (generator.startsWith("Major power producer")) {
      major = mw;
    }
    if (generator.startsWith("All Generators")) {
      all = mw;
    }
  }
  if (major === null || all === null) {
    throw new Error("DUKES 5.11.A headline totals were not found");
  }
  return { major_power_producers: major, all_generators: all };
}

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/** Cover sheet sentence: "published on Thursday 30th July 2026". */
export function parseDukesPublishedAt(rows: readonly (readonly unknown[])[]): string {
  const pattern = /published on [A-Za-z]+ (\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+) (\d{4})/i;
  for (const row of rows) {
    for (const cell of row) {
      const match = pattern.exec(textCell(cell));
      if (!match?.[1] || !match[2] || !match[3]) {
        continue;
      }
      const month = MONTHS[match[2].toLowerCase()];
      if (!month) {
        throw new Error(`DUKES published month is not recognised: ${match[2]}`);
      }
      const day = match[1].padStart(2, "0");
      return `${match[3]}-${month}-${day}T00:00:00.000Z`;
    }
  }
  throw new Error("DUKES cover sheet has no publication date");
}

export function dukesEdition(rows: readonly (readonly unknown[])[]): string {
  const title = textCell(rows[0]?.[0]);
  const match = /May (\d{4})/.exec(title);
  return match?.[1] ? `May ${match[1]}` : "DUKES 5.11";
}
