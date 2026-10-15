import { cleanCountry, cleanName, parseCsv, parseNumber, roundMw } from "@/lib/catalogue/assets/parse";
import { latestDate, parseUkDate } from "@/lib/projects/dates";
import { REPD_PROJECT_RELEASE_ID } from "@/lib/projects/schema";
import type { SourceProject } from "@/lib/projects/source";
import type { ConstructionStatus, OperationalStatus, PlanningStatus } from "@/lib/projects/status";
import { repdProjectTechnology } from "@/lib/projects/technology";

const BRITAIN = ["England", "Scotland", "Wales"] as const;

type Britain = (typeof BRITAIN)[number];

function isBritain(value: string): value is Britain {
  return (BRITAIN as readonly string[]).includes(value);
}

const GRANTED_COLUMN = "Planning Permission  Granted";

type ShortStatus =
  | "Awaiting Construction"
  | "Operational"
  | "Application Submitted"
  | "Application Refused"
  | "Revised"
  | "Application Withdrawn"
  | "Under Construction"
  | "Abandoned"
  | "Planning Permission Expired"
  | "Appeal Refused"
  | "Appeal Withdrawn"
  | "Decommissioned"
  | "No Application Required"
  | "Appeal Lodged";

function column(header: string[], name: string): number {
  const index = header.findIndex((cell) => cell.trim() === name);
  if (index < 0) {
    throw new Error(`REPD column missing: ${name}`);
  }
  return index;
}

function cell(row: string[], index: number): string {
  return row[index] ?? "";
}

function axes(status: ShortStatus): {
  planning: PlanningStatus;
  construction: ConstructionStatus;
  operational: OperationalStatus;
} {
  switch (status) {
    case "Awaiting Construction":
      return { planning: "granted", construction: "not_started", operational: "proposed" };
    case "Operational":
      return { planning: "granted", construction: "built", operational: "operational" };
    case "Application Submitted":
      return { planning: "application_submitted", construction: "unknown", operational: "proposed" };
    case "Application Refused":
      return { planning: "refused", construction: "unknown", operational: "unknown" };
    case "Revised":
      return { planning: "revised", construction: "unknown", operational: "proposed" };
    case "Application Withdrawn":
      return { planning: "withdrawn", construction: "unknown", operational: "unknown" };
    case "Under Construction":
      return { planning: "granted", construction: "under_construction", operational: "proposed" };
    case "Abandoned":
      return { planning: "abandoned", construction: "unknown", operational: "unknown" };
    case "Planning Permission Expired":
      return { planning: "expired", construction: "unknown", operational: "unknown" };
    case "Appeal Refused":
      return { planning: "refused", construction: "unknown", operational: "unknown" };
    case "Appeal Withdrawn":
      return { planning: "appeal_withdrawn", construction: "unknown", operational: "unknown" };
    case "Decommissioned":
      return { planning: "granted", construction: "built", operational: "closed" };
    case "No Application Required":
      return { planning: "no_application_required", construction: "unknown", operational: "proposed" };
    case "Appeal Lodged":
      return { planning: "appeal_lodged", construction: "unknown", operational: "proposed" };
    default: {
      const neverStatus: never = status;
      throw new Error(`REPD development status is not mapped: ${neverStatus}`);
    }
  }
}

function isShortStatus(value: string): value is ShortStatus {
  switch (value) {
    case "Awaiting Construction":
    case "Operational":
    case "Application Submitted":
    case "Application Refused":
    case "Revised":
    case "Application Withdrawn":
    case "Under Construction":
    case "Abandoned":
    case "Planning Permission Expired":
    case "Appeal Refused":
    case "Appeal Withdrawn":
    case "Decommissioned":
    case "No Application Required":
    case "Appeal Lodged":
      return true;
    default:
      return false;
  }
}

function decisionDate(
  planning: PlanningStatus,
  dates: {
    submitted: string | null;
    withdrawn: string | null;
    refused: string | null;
    appealLodged: string | null;
    appealWithdrawn: string | null;
    appealRefused: string | null;
    appealGranted: string | null;
    granted: string | null;
    sosRefusal: string | null;
    sosGranted: string | null;
    expired: string | null;
  },
): string | null {
  switch (planning) {
    case "granted":
      return latestDate([dates.granted, dates.appealGranted, dates.sosGranted]);
    case "refused":
      return latestDate([dates.refused, dates.appealRefused, dates.sosRefusal]);
    case "withdrawn":
      return dates.withdrawn;
    case "appeal_withdrawn":
      return dates.appealWithdrawn;
    case "appeal_lodged":
      return dates.appealLodged;
    case "application_submitted":
    case "revised":
      return dates.submitted;
    case "expired":
      return dates.expired;
    case "abandoned":
    case "no_application_required":
    case "pre_application":
    case "unknown":
      return null;
    default: {
      const neverStatus: never = planning;
      return neverStatus;
    }
  }
}

export function parseRepdProjects(text: string): SourceProject[] {
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
  const grantedIndex = column(header, GRANTED_COLUMN);
  const sosRefusalIndex = column(header, "Secretary of State - Refusal");
  const sosGrantedIndex = column(header, "Secretary of State - Granted");
  const expiredIndex = column(header, "Planning Permission Expired");
  const constructionIndex = column(header, "Under Construction");
  const operationalIndex = column(header, "Operational");

  const projects: SourceProject[] = [];
  for (const row of table.slice(1)) {
    const countryRaw = cleanCountry(cell(row, countryIndex));
    if (countryRaw === "Northern Ireland") {
      continue;
    }
    if (countryRaw !== null && !isBritain(countryRaw)) {
      throw new Error(`REPD country is not mapped: ${countryRaw}`);
    }
    const country: Britain | null = countryRaw;
    const shortStatus = cell(row, statusIndex).replace(/\u00a0/g, " ").trim();
    if (!isShortStatus(shortStatus)) {
      throw new Error(`REPD development status is not mapped: ${shortStatus}`);
    }
    const mapped = axes(shortStatus);
    const externalRef = cell(row, refIndex).trim();
    if (externalRef.length === 0) {
      throw new Error("REPD row has no Ref ID");
    }
    const dates = {
      submitted: parseUkDate(cell(row, submittedIndex)),
      withdrawn: parseUkDate(cell(row, withdrawnIndex)),
      refused: parseUkDate(cell(row, refusedIndex)),
      appealLodged: parseUkDate(cell(row, appealLodgedIndex)),
      appealWithdrawn: parseUkDate(cell(row, appealWithdrawnIndex)),
      appealRefused: parseUkDate(cell(row, appealRefusedIndex)),
      appealGranted: parseUkDate(cell(row, appealGrantedIndex)),
      granted: parseUkDate(cell(row, grantedIndex)),
      sosRefusal: parseUkDate(cell(row, sosRefusalIndex)),
      sosGranted: parseUkDate(cell(row, sosGrantedIndex)),
      expired: parseUkDate(cell(row, expiredIndex)),
    };
    const power = parseNumber(cell(row, capacityIndex));
    const name = cleanName(cell(row, nameIndex)) || externalRef;
    projects.push({
      source_id: "desnz-repd",
      external_ref: externalRef,
      name,
      technology: repdProjectTechnology(cell(row, technologyIndex)),
      country,
      planning_status: mapped.planning,
      planning_decision_date: decisionDate(mapped.planning, dates),
      planning_source_id: "desnz-repd",
      planning_release_id: REPD_PROJECT_RELEASE_ID,
      construction_status: mapped.construction,
      construction_evidence_date: parseUkDate(cell(row, constructionIndex)),
      construction_source_id: "desnz-repd",
      construction_release_id: REPD_PROJECT_RELEASE_ID,
      connection_stage: "unknown",
      connection_gate: "unknown",
      agreement_status: "unknown",
      expected_energisation: null,
      connection_source_id: null,
      connection_release_id: null,
      operational_status: mapped.operational,
      commissioning_date: mapped.operational === "operational" ? parseUkDate(cell(row, operationalIndex)) : null,
      closure_date: null,
      operational_source_id: "desnz-repd",
      operational_release_id: REPD_PROJECT_RELEASE_ID,
      power_mw: power === null ? null : roundMw(power),
      connection_capacity_mw: null,
      storage_energy_mwh: null,
    });
  }
  return projects;
}
