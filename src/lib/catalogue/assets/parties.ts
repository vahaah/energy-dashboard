import { z } from "zod";
import { cleanCountry, cleanName, parseCsv } from "@/lib/catalogue/assets/parse";
import { DUKES_SOURCE_ID, REPD_SOURCE_ID } from "@/lib/catalogue/assets/technologies";

export const PARTY_FILE = "asset_parties.ndjson";

const text = z.string();

export const partyRecordSchema = z
  .object({
    source_id: z.enum([REPD_SOURCE_ID, DUKES_SOURCE_ID]),
    external_ref: text.refine((value) => value.trim().length > 0, "required"),
    operator: text,
    region: text.nullable(),
    county: text.nullable(),
  })
  .strict();

export type PartyRecord = z.infer<typeof partyRecordSchema>;

export type PartyDraft = {
  sourceId: PartyRecord["source_id"];
  externalRef: string;
  operator: string;
  region: string | null;
  county: string | null;
};

function column(header: readonly string[], name: string): number {
  const index = header.findIndex((cell) => cell.trim() === name);
  if (index < 0) {
    throw new Error(`REPD column missing: ${name}`);
  }
  return index;
}

function place(value: string): string | null {
  return cleanCountry(value);
}

function keep(draft: PartyDraft): boolean {
  return draft.operator.length > 0 || draft.region !== null || draft.county !== null;
}

export function partiesFromRepdCsv(textBody: string): PartyDraft[] {
  const table = parseCsv(textBody);
  const header = table[0];
  if (!header) {
    throw new Error("REPD extract is empty");
  }
  const refIndex = column(header, "Ref ID");
  const operatorIndex = column(header, "Operator (or Applicant)");
  const regionIndex = column(header, "Region");
  const countyIndex = column(header, "County");
  const drafts: PartyDraft[] = [];
  for (const row of table.slice(1)) {
    const externalRef = (row[refIndex] ?? "").trim();
    if (externalRef.length === 0) {
      continue;
    }
    const draft: PartyDraft = {
      sourceId: REPD_SOURCE_ID,
      externalRef,
      operator: cleanName(row[operatorIndex] ?? ""),
      region: place(row[regionIndex] ?? ""),
      county: place(row[countyIndex] ?? ""),
    };
    if (keep(draft)) {
      drafts.push(draft);
    }
  }
  return drafts;
}

function normalizedHeader(value: string): string {
  return cleanName(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dukesColumn(header: readonly string[], name: string): number {
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

export function partiesFromDukesRows(rows: readonly (readonly string[])[]): PartyDraft[] {
  const headerIndex = rows.findIndex((row) => {
    const labels = row.map(normalizedHeader);
    return labels.includes("sitename") && labels.some((label) => label.startsWith("companyname"));
  });
  if (headerIndex < 0) {
    throw new Error("DUKES 5.11 station header was not found");
  }
  const header = (rows[headerIndex] ?? []).map(normalizedHeader);
  const codeIndex = dukesColumn(header, "desnzsitecode");
  const operatorIndex = dukesColumn(header, "companyname");
  const regionIndex = dukesColumn(header, "region");
  const drafts: PartyDraft[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(headerIndex + 1)) {
    const externalRef = cleanName(row[codeIndex] ?? "");
    if (externalRef.length === 0 || seen.has(externalRef)) {
      continue;
    }
    seen.add(externalRef);
    const draft: PartyDraft = {
      sourceId: DUKES_SOURCE_ID,
      externalRef,
      operator: cleanName(row[operatorIndex] ?? ""),
      region: place(row[regionIndex] ?? ""),
      county: null,
    };
    if (keep(draft)) {
      drafts.push(draft);
    }
  }
  return drafts;
}

export function partyLine(draft: PartyDraft): PartyRecord {
  return {
    source_id: draft.sourceId,
    external_ref: draft.externalRef,
    operator: draft.operator,
    region: draft.region,
    county: draft.county,
  };
}

export function partyKey(record: Pick<PartyRecord, "source_id" | "external_ref">): string {
  return `${record.source_id}\t${record.external_ref}`;
}
