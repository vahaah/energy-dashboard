/**
 * One-shot import of DESNZ DUKES table 1.1 (ktoe) as a UK annual TWh balance.
 *
 *   npx tsx scripts/catalogue/whole-energy.ts
 *   npx tsx scripts/catalogue/whole-energy.ts --offline
 *
 * No cron. The raw workbook stays in data/catalogue/raw, which is gitignored.
 * The release id is checked before whole-energy.json is written.
 * A matching rerun appends an ingestion run and leaves the release line.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { sha256Bytes } from "../../src/lib/catalogue/canonical";
import { buildWholeEnergyEdition } from "../../src/lib/whole-energy/build";
import { commitWholeEnergyEdition } from "../../src/lib/whole-energy/catalogue-write";
import { parseBalanceSheet } from "../../src/lib/whole-energy/parse";
import { fetchBytes, fetchText, readCache, writeCache } from "./http";

const PUBLICATION_URL =
  "https://www.gov.uk/government/statistics/energy-chapter-1-digest-of-united-kingdom-energy-statistics-dukes";
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

function latestWorkbook(html: string): string {
  const match =
    /https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[a-z0-9]+\/DUKES_1\.1\.xlsx/i.exec(html);
  const url = match?.[0];
  if (!url) {
    throw new Error(`no DUKES 1.1 workbook on ${PUBLICATION_URL}`);
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
    return unwrap(value.result as ExcelJS.CellValue);
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

async function workbook(bytes: Buffer): Promise<ExcelJS.Workbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(workbookBytes(bytes));
  return book;
}

function sheetRows(sheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values;
    if (!Array.isArray(values)) {
      return;
    }
    const raw = values.slice(1);
    const line: unknown[] = [];
    for (let index = 0; index < Math.max(raw.length, 12); index += 1) {
      line.push(unwrap(raw[index] as ExcelJS.CellValue));
    }
    rows.push(line);
  });
  return rows;
}

function publishedAt(cover: string): string {
  const match = /published on [A-Za-z]+ (\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+) (\d{4})/i.exec(cover);
  const day = match?.[1];
  const monthName = match?.[2]?.toLowerCase();
  const year = match?.[3];
  const month = monthName ? MONTHS[monthName] : undefined;
  if (!day || !month || !year) {
    throw new Error("DUKES 1.1 cover has no publication date");
  }
  if (!/thousand tonnes of oil equivalent \(ktoe\)/i.test(cover)) {
    throw new Error("DUKES 1.1 cover does not say the unit is ktoe");
  }
  return `${year}-${month}-${day.padStart(2, "0")}T00:00:00.000Z`;
}

function latestYearSheet(book: ExcelJS.Workbook): { year: number; sheet: ExcelJS.Worksheet } {
  let year = 0;
  let sheet: ExcelJS.Worksheet | undefined;
  for (const candidate of book.worksheets) {
    if (!/^\d{4}$/.test(candidate.name)) {
      continue;
    }
    const value = Number(candidate.name);
    if (value > year) {
      year = value;
      sheet = candidate;
    }
  }
  if (!sheet) {
    throw new Error("DUKES 1.1 workbook has no year sheet");
  }
  return { year, sheet };
}

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  const root = process.cwd();
  const cache = resolve(root, "data/catalogue/raw/dukes-1.1.xlsx");
  const metaPath = resolve(root, "data/catalogue/raw/dukes-1.1.json");
  let bytes: Buffer;
  let downloadUrl: string;
  if (offline) {
    const cached = readCache(cache);
    if (!cached) {
      throw new Error("offline DUKES cache is missing data/catalogue/raw/dukes-1.1.xlsx");
    }
    bytes = cached;
    const meta = JSON.parse(readCache(metaPath)?.toString("utf8") ?? "{}") as { downloadUrl?: string };
    if (!meta.downloadUrl) {
      throw new Error("offline DUKES cache is missing data/catalogue/raw/dukes-1.1.json");
    }
    downloadUrl = meta.downloadUrl;
  } else {
    const html = await fetchText(PUBLICATION_URL);
    downloadUrl = latestWorkbook(html);
    bytes = await fetchBytes(downloadUrl);
    writeCache(cache, bytes);
    writeFileSync(metaPath, `${JSON.stringify({ downloadUrl }, null, 2)}\n`);
  }

  const book = await workbook(bytes);
  const coverSheet = book.getWorksheet("Cover Sheet");
  if (!coverSheet) {
    throw new Error("DUKES 1.1 workbook is missing the cover sheet");
  }
  const cover = sheetRows(coverSheet)
    .flat()
    .filter((cell) => typeof cell === "string")
    .join("\n");
  const { year, sheet } = latestYearSheet(book);
  const parsed = parseBalanceSheet(sheetRows(sheet), year);
  const edition = buildWholeEnergyEdition({
    year,
    publishedAt: publishedAt(cover),
    downloadUrl,
    extractSha256: sha256Bytes(bytes),
    bytes: bytes.byteLength,
    rows: parsed.rows,
  });

  const committed = commitWholeEnergyEdition(root, edition);
  console.log(
    `wrote ${edition.year} ${edition.published_at} ${edition.extract_sha256} (${edition.bytes} bytes) ${committed.ingestionRunId}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "DUKES 1.1 import failed";
  console.error(message);
  process.exit(1);
});
