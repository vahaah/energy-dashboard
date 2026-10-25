/**
 * RIIO-ED2 annual performance, sheet "Ch2 outputs - reliability".
 * Official file (OGL v3), published 15 Jan 2026. No figures are filled in by hand:
 * a moved label or header throws and leaves the checked-in JSON alone.
 *
 * https://www.ofgem.gov.uk/transparency-document/riio-2-electricity-distribution-annual-report-2024-2025
 */
import { inflateRawSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PAGE_URL =
  "https://www.ofgem.gov.uk/transparency-document/riio-2-electricity-distribution-annual-report-2024-2025";
const FILE_URL =
  "https://www.ofgem.gov.uk/sites/default/files/2026-01/ED2-annual-summary-report-2024-2025-supplementary-datafile.xlsm";
const SHEET_NAME = "Ch2 outputs - reliability";
const OUT = resolve(process.cwd(), "data/power-cuts/ofgem-ci-cml.json");
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_RETRIES = 2;

const LABELS = [
  "SP ENW",
  "NPgN",
  "NPgY",
  "WMID",
  "EMID",
  "SWALES",
  "SWEST",
  "LPN",
  "SPN",
  "EPN",
  "SPD",
  "SPMW",
  "SSEH",
  "SSES",
] as const;

const NAMES: Record<(typeof LABELS)[number], string> = {
  "SP ENW": "SP Electricity North West",
  NPgN: "Northern Powergrid North East",
  NPgY: "Northern Powergrid Yorkshire",
  WMID: "West Midlands",
  EMID: "East Midlands",
  SWALES: "South Wales",
  SWEST: "South West",
  LPN: "London",
  SPN: "South East",
  EPN: "East of England",
  SPD: "SP Distribution",
  SPMW: "SP Manweb",
  SSEH: "SSEN North",
  SSES: "SSEN South",
};

const CI_FIRST_ROW = 14;
const CML_FIRST_ROW = 32;
const LABEL_COL = 4;
const VALUE_COL = 6;
const TARGET_COL = 14;

type Cell = { value: string; numeric: boolean };

function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      break;
    }
    const method = buffer.readUInt16LE(offset + 8);
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const slice = buffer.subarray(start, start + compressed);
    if (method === 0) {
      files.set(name, Buffer.from(slice));
    } else if (method === 8) {
      files.set(name, inflateRawSync(slice));
    } else {
      throw new Error(`unsupported zip method ${method} on ${name}`);
    }
    offset = start + compressed;
  }
  return files;
}

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  const items = xml.match(/<si[\s\S]*?<\/si>/g) ?? [];
  for (const item of items) {
    const texts = [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1] ?? ""));
    out.push(texts.join(""));
  }
  return out;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnIndex(letters: string): number {
  let index = 0;
  for (const character of letters) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index;
}

function sheetCells(xml: string, strings: readonly string[]): Map<number, Map<number, Cell>> {
  const rows = new Map<number, Map<number, Cell>>();
  for (const row of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const rowNumber = Number(/r="(\d+)"/.exec(row)?.[1]);
    if (!Number.isFinite(rowNumber)) {
      continue;
    }
    const cells = new Map<number, Cell>();
    for (const cell of row.match(/<c\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = /r="([A-Z]+)(\d+)"/.exec(cell);
      const letters = ref?.[1];
      if (!letters) {
        continue;
      }
      const type = /t="([^"]+)"/.exec(cell)?.[1] ?? "";
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(cell)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cell)?.[1] ?? "";
      let value = inline != null ? decodeXml(inline) : decodeXml(raw);
      if (type === "s") {
        value = strings[Number(value)] ?? "";
      }
      cells.set(columnIndex(letters), { value: value.trim(), numeric: type !== "s" && inline == null });
    }
    rows.set(rowNumber, cells);
  }
  return rows;
}

function sheetPath(files: Map<string, Buffer>): string {
  const workbook = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const sheet = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find(
    (match) => match[1] === SHEET_NAME,
  );
  const id = sheet?.[2];
  if (!id) {
    throw new Error(`sheet ${SHEET_NAME} was not in the workbook`);
  }
  const target = new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
  if (!target) {
    throw new Error(`relationship ${id} was not in the workbook`);
  }
  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`;
}

function numberAt(rows: Map<number, Map<number, Cell>>, row: number, column: number, label: string): number {
  const cell = rows.get(row)?.get(column);
  const value = Number(cell?.value);
  if (!cell || !Number.isFinite(value)) {
    throw new Error(`missing number for ${label} at row ${row} column ${column}`);
  }
  return Math.round(value * 100) / 100;
}

function labelAt(rows: Map<number, Map<number, Cell>>, row: number): string {
  return rows.get(row)?.get(LABEL_COL)?.value ?? "";
}

function block(
  rows: Map<number, Map<number, Cell>>,
  firstRow: number,
  kind: "CI" | "CML",
): number[][] {
  const values: number[][] = [];
  for (let index = 0; index < LABELS.length; index += 1) {
    const row = firstRow + index;
    const expected = LABELS[index] ?? "";
    const label = labelAt(rows, row);
    if (label !== expected) {
      throw new Error(`${kind} row ${row} label is ${JSON.stringify(label)}, expected ${JSON.stringify(expected)}`);
    }
    values.push([
      numberAt(rows, row, VALUE_COL, `${kind} ${label}`),
      numberAt(rows, row, TARGET_COL, `${kind} target ${label}`),
    ]);
  }
  return values;
}

function headerYear(rows: Map<number, Map<number, Cell>>, row: number): void {
  const header = rows.get(row)?.get(VALUE_COL)?.value ?? "";
  if (!header.includes("2024/25")) {
    throw new Error(`row ${row} column ${VALUE_COL} header is ${JSON.stringify(header)}, expected 2024/25`);
  }
}

async function download(url: string): Promise<Buffer> {
  let last = "download failed";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status >= 500) {
        last = `HTTP ${response.status}`;
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > MAX_BYTES) {
        throw new Error("Ofgem file is larger than 20 MB");
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) {
        throw new Error("Ofgem file is larger than 20 MB");
      }
      return buffer;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        last = "timed out";
        continue;
      }
      throw error;
    }
  }
  throw new Error(last);
}

async function loadBuffer(): Promise<Buffer> {
  const file = process.argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
  if (file) {
    return readFileSync(resolve(file));
  }
  return download(FILE_URL);
}

async function main(): Promise<void> {
  const files = unzip(await loadBuffer());
  const path = sheetPath(files);
  const sheet = files.get(path);
  if (!sheet) {
    throw new Error(`missing worksheet ${path}`);
  }
  const strings = sharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const rows = sheetCells(sheet.toString("utf8"), strings);
  headerYear(rows, CI_FIRST_ROW - 1);
  headerYear(rows, CML_FIRST_ROW - 1);
  const ci = block(rows, CI_FIRST_ROW, "CI");
  const cml = block(rows, CML_FIRST_ROW, "CML");
  const document = {
    source_url: FILE_URL,
    page_url: PAGE_URL,
    published: "2026-01-15",
    year: "2024/25",
    ci_unit: "interruptions per 100 customers",
    cml_unit: "minutes",
    licence: "Open Government Licence v3.0",
    attribution: "Contains Ofgem data licensed under the Open Government Licence v3.0.",
    note: "A higher figure is worse. The sheet total is the published GB total and is not the sum of these rows.",
    rows: LABELS.map((label, index) => ({
      label,
      name: NAMES[label],
      ci: ci[index]?.[0] ?? null,
      ci_target: ci[index]?.[1] ?? null,
      cml: cml[index]?.[0] ?? null,
      cml_target: cml[index]?.[1] ?? null,
    })),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`wrote ${document.rows.length} rows to ${OUT}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "ofgem import failed";
  console.error(message);
  process.exit(1);
});
