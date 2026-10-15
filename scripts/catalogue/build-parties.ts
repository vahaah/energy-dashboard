/**
 * Operator, region and county for the asset search index.
 *
 * Reads the same REPD CSV and DUKES 5.11 workbook the register was built from,
 * checks their sha256 against source_releases.ndjson, and writes
 * data/catalogue/asset_parties.ndjson. It does not download. Pass the files:
 *
 *   npx tsx scripts/catalogue/build-parties.ts --repd data/catalogue/raw/repd.csv --dukes data/catalogue/raw/dukes.xlsx
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { parseNdjson } from "../../src/lib/catalogue/load";
import {
  partiesFromDukesRows,
  partiesFromRepdCsv,
  partyKey,
  partyLine,
  PARTY_FILE,
  type PartyDraft,
} from "../../src/lib/catalogue/assets/parties";
import { projectRecordSchema } from "../../src/lib/catalogue/assets/record-schema";
import { sourceReleaseSchema } from "../../src/lib/catalogue/schema";

function readFlag(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a path`);
  }
  return resolve(value);
}

function sha256(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function releaseHash(datasetId: string): string {
  const text = readFileSync(resolve("data/catalogue/source_releases.ndjson"), "utf8");
  const parsed = parseNdjson(text, "source_releases.ndjson");
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("\n"));
  }
  for (const value of parsed.data) {
    const release = sourceReleaseSchema.parse(value);
    if (release.dataset_id !== datasetId || !release.content || typeof release.content !== "object") {
      continue;
    }
    const hash = (release.content as { extract_sha256?: unknown }).extract_sha256;
    if (typeof hash === "string") {
      return hash;
    }
  }
  throw new Error(`no extract_sha256 for ${datasetId}`);
}

function cellText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const record = value as { richText?: { text?: string }[]; text?: string; result?: unknown };
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => part.text ?? "").join("");
    }
    if (typeof record.text === "string") {
      return record.text;
    }
    if ("result" in record) {
      return cellText(record.result);
    }
  }
  return "";
}

async function dukesRows(path: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet("5.11 Full list");
  if (!sheet) {
    throw new Error("DUKES workbook has no 5.11 Full list sheet");
  }
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values: string[] = [];
    const width = Math.max(sheet.columnCount, 20);
    for (let column = 1; column <= width; column += 1) {
      values.push(cellText(row.getCell(column).value));
    }
    rows.push(values);
  });
  return rows;
}

function projectKeys(): Set<string> {
  const text = readFileSync(resolve("data/catalogue/projects.ndjson"), "utf8");
  const parsed = parseNdjson(text, "projects.ndjson");
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("\n"));
  }
  const keys = new Set<string>();
  for (const value of parsed.data) {
    const project = projectRecordSchema.parse(value);
    keys.add(partyKey({ source_id: project.source_id, external_ref: project.external_ref }));
  }
  return keys;
}

function select(drafts: readonly PartyDraft[], keys: ReadonlySet<string>): PartyDraft[] {
  const chosen = new Map<string, PartyDraft>();
  for (const draft of drafts) {
    const key = partyKey({ source_id: draft.sourceId, external_ref: draft.externalRef });
    if (!keys.has(key) || chosen.has(key)) {
      continue;
    }
    chosen.set(key, draft);
  }
  return [...chosen.values()].sort((left, right) => {
    const key = partyKey({ source_id: left.sourceId, external_ref: left.externalRef });
    const other = partyKey({ source_id: right.sourceId, external_ref: right.externalRef });
    return key < other ? -1 : key > other ? 1 : 0;
  });
}

async function main(): Promise<void> {
  const repdPath = readFlag("--repd");
  const dukesPath = readFlag("--dukes");
  const repdHash = sha256(repdPath);
  const dukesHash = sha256(dukesPath);
  const expectedRepd = releaseHash("desnz-repd:repd-quarterly");
  const expectedDukes = releaseHash("desnz-dukes:dukes-5.11");
  if (repdHash !== expectedRepd) {
    throw new Error(`REPD sha256 ${repdHash} does not match ${expectedRepd}`);
  }
  if (dukesHash !== expectedDukes) {
    throw new Error(`DUKES sha256 ${dukesHash} does not match ${expectedDukes}`);
  }
  const keys = projectKeys();
  const repd = partiesFromRepdCsv(readFileSync(repdPath).toString("latin1"));
  const dukes = partiesFromDukesRows(await dukesRows(dukesPath));
  const selected = select([...repd, ...dukes], keys);
  const lines = selected.map((draft) => JSON.stringify(partyLine(draft)));
  const destination = resolve("data/catalogue", PARTY_FILE);
  writeFileSync(destination, `${lines.join("\n")}\n`);
  console.log(`wrote ${selected.length} parties to ${destination}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
