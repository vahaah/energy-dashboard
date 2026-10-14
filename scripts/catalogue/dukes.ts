/**
 * Download the latest DESNZ DUKES table 5.11 (power stations in the United Kingdom).
 *
 *   npx tsx scripts/catalogue/dukes.ts
 *   npx tsx scripts/catalogue/dukes.ts --offline
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { sha256Bytes } from "../../src/lib/catalogue/canonical";
import {
  dukesEdition,
  parseDukesHeadline,
  parseDukesPublishedAt,
  parseDukesStations,
  type DukesHeadline,
} from "../../src/lib/catalogue/assets/dukes";
import type { CatalogueStation } from "../../src/lib/catalogue/assets/types";
import { fetchBytes, fetchText, readCache, writeCache } from "./http";

const PUBLICATION_URL =
  "https://www.gov.uk/government/statistics/electricity-chapter-5-digest-of-united-kingdom-energy-statistics-dukes";

export type DukesExtract = {
  bytes: Buffer;
  downloadUrl: string;
  publishedAt: string;
  edition: string;
  stations: CatalogueStation[];
  headline: DukesHeadline;
};

function latestWorkbook(html: string): string {
  const match =
    /https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[a-z0-9]+\/DUKES_5\.11\.xlsx/i.exec(html);
  const url = match?.[0];
  if (!url) {
    throw new Error(`no DUKES 5.11 workbook on ${PUBLICATION_URL}`);
  }
  return url;
}

function unwrap(value: ExcelJS.CellValue): unknown {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && "result" in value) {
    return unwrap(value.result);
  }
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }
  return null;
}

function workbookBytes(bytes: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function sheetRows(bytes: Buffer, name: string): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBytes(bytes));
  const sheet = workbook.getWorksheet(name);
  if (!sheet) {
    throw new Error(`DUKES workbook is missing sheet ${name}`);
  }
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values;
    if (!Array.isArray(values)) {
      return;
    }
    rows.push(values.slice(1).map((cell) => unwrap(cell as ExcelJS.CellValue)));
  });
  return rows;
}

export async function loadDukes(offline = false, catalogueRoot = process.cwd()): Promise<DukesExtract> {
  const cache = resolve(catalogueRoot, "data/catalogue/raw/dukes-5.11.xlsx");
  const metaPath = resolve(catalogueRoot, "data/catalogue/raw/dukes-5.11.json");
  let bytes: Buffer;
  let downloadUrl: string;
  if (offline) {
    const cached = readCache(cache);
    if (!cached) {
      throw new Error("offline DUKES cache is missing data/catalogue/raw/dukes-5.11.xlsx");
    }
    bytes = cached;
    const meta = JSON.parse(readCache(metaPath)?.toString("utf8") ?? "{}") as { downloadUrl?: string };
    if (!meta.downloadUrl) {
      throw new Error("offline DUKES cache is missing data/catalogue/raw/dukes-5.11.json");
    }
    downloadUrl = meta.downloadUrl;
  } else {
    const html = await fetchText(PUBLICATION_URL);
    downloadUrl = latestWorkbook(html);
    bytes = await fetchBytes(downloadUrl);
    writeCache(cache, bytes);
    writeFileSync(metaPath, JSON.stringify({ downloadUrl }, null, 2) + "\n");
  }
  const fullList = await sheetRows(bytes, "5.11 Full list");
  const summary = await sheetRows(bytes, "5.11 Summary");
  const cover = await sheetRows(bytes, "Cover Sheet");
  return {
    bytes,
    downloadUrl,
    publishedAt: parseDukesPublishedAt(cover),
    edition: dukesEdition(fullList),
    stations: parseDukesStations(fullList),
    headline: parseDukesHeadline(summary),
  };
}

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  const extract = await loadDukes(offline);
  console.log(
    JSON.stringify(
      {
        edition: extract.edition,
        publishedAt: extract.publishedAt,
        downloadUrl: extract.downloadUrl,
        extract_sha256: sha256Bytes(extract.bytes),
        stations: extract.stations.length,
        headline: extract.headline,
      },
      null,
      2,
    ),
  );
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("dukes.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
