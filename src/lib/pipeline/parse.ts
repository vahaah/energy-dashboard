import { cleanName, parseCsv, parseNumber, roundMw } from "@/lib/catalogue/assets/parse";
import { parseUkDate } from "@/lib/projects/dates";
import { repdProjectTechnology } from "@/lib/projects/technology";
import {
  PIPELINE_COUNTRIES,
  type PipelineCountry,
  type PipelineRecord,
  type RepdShortStatus,
} from "@/lib/pipeline/records";

const STATUS_BY_KEY: Record<string, RepdShortStatus> = {
  "awaiting construction": "awaiting_construction",
  operational: "operational",
  "application submitted": "application_submitted",
  "application refused": "application_refused",
  revised: "revised",
  "application withdrawn": "application_withdrawn",
  "under construction": "under_construction",
  abandoned: "abandoned",
  "planning permission expired": "permission_expired",
  "appeal refused": "appeal_refused",
  "appeal withdrawn": "appeal_withdrawn",
  decommissioned: "decommissioned",
  "no application required": "no_application_required",
  "appeal lodged": "appeal_lodged",
};

function column(header: string[], name: string): number {
  const index = header.findIndex((cell) => cell.trim() === name.trim() || cell === name);
  if (index < 0) {
    throw new Error(`REPD column missing: ${name}`);
  }
  return index;
}

function cell(row: string[], index: number): string {
  return row[index] ?? "";
}

/** Trim, collapse whitespace, and match a known REPD short status. */
export function normaliseRepdStatus(raw: string): RepdShortStatus {
  const key = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const status = STATUS_BY_KEY[key];
  if (!status) {
    throw new Error(`REPD development status is not mapped: ${raw.trim()}`);
  }
  return status;
}

export function normalisePipelineCountry(raw: string): PipelineCountry | null {
  const cleaned = cleanName(raw);
  if (cleaned.length === 0 || cleaned.toLowerCase() === "not set") {
    return null;
  }
  const match = PIPELINE_COUNTRIES.find((country) => country.toLowerCase() === cleaned.toLowerCase());
  if (!match) {
    throw new Error(`REPD country is not mapped: ${cleaned}`);
  }
  return match;
}

function dateCell(value: string): string | null {
  return parseUkDate(value);
}

export function parseRepdPipeline(text: string): PipelineRecord[] {
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
  const submittedIndex = column(header, "Planning Application Submitted");
  const withdrawnIndex = column(header, "Planning Application Withdrawn");
  const refusedIndex = column(header, "Planning Permission Refused");
  const appealLodgedIndex = column(header, "Appeal Lodged");
  const appealWithdrawnIndex = column(header, "Appeal Withdrawn");
  const appealRefusedIndex = column(header, "Appeal Refused");
  const appealGrantedIndex = column(header, "Appeal Granted");
  const grantedIndex = column(header, "Planning Permission  Granted");
  const sosRefusalIndex = column(header, "Secretary of State - Refusal");
  const sosGrantedIndex = column(header, "Secretary of State - Granted");
  const expiredIndex = column(header, "Planning Permission Expired");
  const constructionIndex = column(header, "Under Construction");
  const operationalIndex = column(header, "Operational");

  const records: PipelineRecord[] = [];
  for (const row of table.slice(1)) {
    const ref = cell(row, refIndex).replace(/\u00a0/g, " ").trim();
    if (ref.length === 0) {
      throw new Error("REPD row has no Ref ID");
    }
    const mw = parseNumber(cell(row, capacityIndex));
    records.push({
      ref,
      name: cleanName(cell(row, nameIndex)) || ref,
      technology: repdProjectTechnology(cell(row, technologyIndex)),
      country: normalisePipelineCountry(cell(row, countryIndex)),
      status: normaliseRepdStatus(cell(row, statusIndex)),
      mw: mw === null ? null : roundMw(mw),
      submitted: dateCell(cell(row, submittedIndex)),
      granted: dateCell(cell(row, grantedIndex)),
      appeal_granted: dateCell(cell(row, appealGrantedIndex)),
      sos_granted: dateCell(cell(row, sosGrantedIndex)),
      refused: dateCell(cell(row, refusedIndex)),
      withdrawn: dateCell(cell(row, withdrawnIndex)),
      appeal_lodged: dateCell(cell(row, appealLodgedIndex)),
      appeal_withdrawn: dateCell(cell(row, appealWithdrawnIndex)),
      appeal_refused: dateCell(cell(row, appealRefusedIndex)),
      sos_refused: dateCell(cell(row, sosRefusalIndex)),
      expired: dateCell(cell(row, expiredIndex)),
      construction: dateCell(cell(row, constructionIndex)),
      operational: dateCell(cell(row, operationalIndex)),
    });
  }
  records.sort((left, right) => left.ref.localeCompare(right.ref, "en", { numeric: true }));
  return records;
}
