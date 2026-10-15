import { cleanName, parseCsv, parseNumber, roundMw } from "@/lib/catalogue/assets/parse";
import { expectedEnergisation, parseIsoDate } from "@/lib/projects/dates";
import { TEC_PROJECT_RELEASE_ID, TEC_PUBLISHED_AT } from "@/lib/projects/schema";
import type { SourceProject } from "@/lib/projects/source";
import {
  furtherConstruction,
  furtherOperational,
  furtherPlanning,
  type AgreementStatus,
  type ConnectionGate,
  type ConnectionStage,
  type ConstructionStatus,
  type OperationalStatus,
  type PlanningStatus,
} from "@/lib/projects/status";
import { tecProjectTechnology, type ProjectTechnology } from "@/lib/projects/technology";

const TEC_AS_OF = TEC_PUBLISHED_AT.slice(0, 10);

type TecStatus = "Scoping" | "Awaiting Consents" | "Consents Approved" | "Under Construction/Commissioning" | "Built";

type TecRow = {
  name: string;
  stage: ConnectionStage;
  cumulativeMw: number | null;
  effectiveFrom: string | null;
  status: TecStatus;
  agreement: "Direct Connection" | "Embedded";
  technology: ProjectTechnology;
  projectId: string;
  gate: ConnectionGate;
};

export type TecParse =
  | { ok: true; rows: SourceProject[] }
  | { ok: false; reason: string };

function column(header: string[], name: string): number {
  const index = header.findIndex((cell) => cell.trim() === name);
  if (index < 0) {
    throw new Error(`TEC column missing: ${name}`);
  }
  return index;
}

function isTecStatus(value: string): value is TecStatus {
  switch (value) {
    case "Scoping":
    case "Awaiting Consents":
    case "Consents Approved":
    case "Under Construction/Commissioning":
    case "Built":
      return true;
    default:
      return false;
  }
}

function axes(status: TecStatus): {
  planning: PlanningStatus;
  construction: ConstructionStatus;
  operational: OperationalStatus;
} {
  switch (status) {
    case "Scoping":
      return { planning: "pre_application", construction: "unknown", operational: "proposed" };
    case "Awaiting Consents":
      return { planning: "application_submitted", construction: "unknown", operational: "proposed" };
    case "Consents Approved":
      return { planning: "granted", construction: "not_started", operational: "proposed" };
    case "Under Construction/Commissioning":
      return { planning: "unknown", construction: "under_construction", operational: "commissioning" };
    case "Built":
      return { planning: "unknown", construction: "built", operational: "operational" };
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

function parseStage(value: string): ConnectionStage | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "unknown";
  }
  const match = /^([1-9])(?:\.0+)?$/.exec(trimmed);
  if (!match?.[1]) {
    return null;
  }
  switch (match[1]) {
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
      return match[1];
    default:
      return null;
  }
}

function parseGate(value: string): ConnectionGate | null {
  switch (value.trim()) {
    case "":
      return "unknown";
    case "1":
      return "gate_1";
    case "2":
      return "gate_2";
    default:
      return null;
  }
}

function furtherGate(current: ConnectionGate, next: ConnectionGate): ConnectionGate {
  if (next === "gate_2" || current === "gate_2") {
    return "gate_2";
  }
  if (next === "gate_1" || current === "gate_1") {
    return "gate_1";
  }
  return "unknown";
}

function furtherStage(current: ConnectionStage, next: ConnectionStage): ConnectionStage {
  if (current === "unknown") {
    return next;
  }
  if (next === "unknown") {
    return current;
  }
  return next > current ? next : current;
}

function agreementFor(status: TecStatus): AgreementStatus {
  return status === "Built" ? "connected" : "held";
}

function furtherAgreement(current: AgreementStatus, next: AgreementStatus): AgreementStatus {
  if (current === "connected" || next === "connected") {
    return "connected";
  }
  if (current === "held" || next === "held") {
    return "held";
  }
  return "unknown";
}

export function parseTecProjects(text: string): TecParse {
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "TEC file could not be read";
    return { ok: false, reason: message };
  }
  const header = table[0];
  if (!header) {
    return { ok: false, reason: "TEC extract is empty" };
  }
  let nameIndex: number;
  let stageIndex: number;
  let cumulativeIndex: number;
  let effectiveIndex: number;
  let statusIndex: number;
  let agreementIndex: number;
  let plantIndex: number;
  let idIndex: number;
  let gateIndex: number;
  try {
    nameIndex = column(header, "Project Name");
    stageIndex = column(header, "Stage");
    cumulativeIndex = column(header, "Cumulative Total Capacity (MW)");
    effectiveIndex = column(header, "MW Effective From");
    statusIndex = column(header, "Project Status");
    agreementIndex = column(header, "Agreement Type");
    plantIndex = column(header, "Plant Type");
    idIndex = column(header, "Project ID");
    gateIndex = column(header, "Gate");
  } catch (error) {
    const message = error instanceof Error ? error.message : "TEC column missing";
    return { ok: false, reason: message };
  }

  const grouped = new Map<string, TecRow[]>();
  for (const row of table.slice(1)) {
    const status = (row[statusIndex] ?? "").trim();
    if (!isTecStatus(status)) {
      return { ok: false, reason: `TEC project status is not on the allowlist: ${status}` };
    }
    const agreement = (row[agreementIndex] ?? "").trim();
    if (agreement !== "Direct Connection" && agreement !== "Embedded") {
      return { ok: false, reason: `TEC agreement type is not on the allowlist: ${agreement}` };
    }
    const stage = parseStage(row[stageIndex] ?? "");
    if (!stage) {
      return { ok: false, reason: `TEC stage is not on the allowlist: ${row[stageIndex] ?? ""}` };
    }
    const gate = parseGate(row[gateIndex] ?? "");
    if (!gate) {
      return { ok: false, reason: `TEC gate is not on the allowlist: ${row[gateIndex] ?? ""}` };
    }
    const projectId = (row[idIndex] ?? "").trim();
    if (projectId.length === 0) {
      return { ok: false, reason: "TEC row has no Project ID" };
    }
    let technology: ProjectTechnology;
    try {
      technology = tecProjectTechnology(row[plantIndex] ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "TEC plant type is not mapped";
      return { ok: false, reason: message };
    }
    const cumulative = parseNumber(row[cumulativeIndex]);
    if (cumulative !== null && cumulative < 0) {
      return { ok: false, reason: "TEC cumulative capacity is negative" };
    }
    const parsed: TecRow = {
      name: cleanName(row[nameIndex] ?? "") || projectId,
      stage,
      cumulativeMw: cumulative === null ? null : roundMw(cumulative),
      effectiveFrom: parseIsoDate(row[effectiveIndex] ?? ""),
      status,
      agreement,
      technology,
      projectId,
      gate,
    };
    const list = grouped.get(projectId) ?? [];
    list.push(parsed);
    grouped.set(projectId, list);
  }

  const rows: SourceProject[] = [];
  for (const [projectId, stages] of grouped) {
    rows.push(collapseStages(projectId, stages));
  }
  rows.sort((left, right) => left.external_ref.localeCompare(right.external_ref));
  return { ok: true, rows };
}

function collapseStages(projectId: string, stages: readonly TecRow[]): SourceProject {
  const ordered = [...stages].sort((left, right) => left.stage.localeCompare(right.stage) || left.name.localeCompare(right.name));
  const first = ordered[0];
  if (!first) {
    throw new Error(`TEC project ${projectId} has no rows`);
  }
  let planning: PlanningStatus = "unknown";
  let construction: ConstructionStatus = "unknown";
  let operational: OperationalStatus = "unknown";
  let gate: ConnectionGate = "unknown";
  let stage: ConnectionStage = "unknown";
  let agreement: AgreementStatus = "unknown";
  let capacity: number | null = null;
  let name = first.name;
  let technology = first.technology;
  for (const row of ordered) {
    const mapped = axes(row.status);
    planning = furtherPlanning(planning, mapped.planning);
    construction = furtherConstruction(construction, mapped.construction);
    operational = furtherOperational(operational, mapped.operational);
    gate = furtherGate(gate, row.gate);
    stage = furtherStage(stage, row.stage);
    agreement = furtherAgreement(agreement, agreementFor(row.status));
    if (row.cumulativeMw !== null && (capacity === null || row.cumulativeMw > capacity)) {
      capacity = row.cumulativeMw;
      technology = row.technology;
    }
    if (row.name.length > name.length) {
      name = row.name;
    }
  }
  return {
    source_id: "neso-open-data",
    external_ref: projectId,
    name,
    technology,
    country: null,
    planning_status: planning,
    planning_decision_date: null,
    planning_source_id: "neso-open-data",
    planning_release_id: TEC_PROJECT_RELEASE_ID,
    construction_status: construction,
    construction_evidence_date: null,
    construction_source_id: "neso-open-data",
    construction_release_id: TEC_PROJECT_RELEASE_ID,
    connection_stage: stage,
    connection_gate: gate,
    agreement_status: agreement,
    expected_energisation: expectedEnergisation(
      ordered.map((row) => row.effectiveFrom),
      TEC_AS_OF,
    ),
    connection_source_id: "neso-open-data",
    connection_release_id: TEC_PROJECT_RELEASE_ID,
    operational_status: operational,
    commissioning_date: null,
    closure_date: null,
    operational_source_id: "neso-open-data",
    operational_release_id: TEC_PROJECT_RELEASE_ID,
    power_mw: null,
    connection_capacity_mw: capacity,
    storage_energy_mwh: null,
  };
}
