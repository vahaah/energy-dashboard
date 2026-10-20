import { CHANGES_SUPERSEDED, CHANGES_SUPERSEDES } from "@/lib/changes/copy";
import { DIFF_FIELDS, type DiffField } from "@/lib/projects/diff";
import type { ChangeEvent } from "@/lib/projects/schema";
import {
  agreementLabel,
  constructionLabel,
  gateLabel,
  operationalLabel,
  planningLabel,
  stageLabel,
  AGREEMENT_STATUSES,
  CONSTRUCTION_STATUSES,
  CONNECTION_GATES,
  CONNECTION_STAGES,
  OPERATIONAL_STATUSES,
  PLANNING_STATUSES,
  type AgreementStatus,
  type ConnectionGate,
  type ConnectionStage,
  type ConstructionStatus,
  type OperationalStatus,
  type PlanningStatus,
} from "@/lib/projects/status";

const DIFF_FIELD_SET = new Set<string>(DIFF_FIELDS);

export function changeFieldLabel(field: string): string {
  if (!isLabelledField(field)) {
    return field.replaceAll("_", " ");
  }
  switch (field) {
    case "planning_status":
      return "planning status";
    case "planning_decision_date":
      return "planning decision date";
    case "construction_status":
      return "construction status";
    case "construction_evidence_date":
      return "construction evidence date";
    case "connection_stage":
      return "connection stage";
    case "connection_gate":
      return "connection gate";
    case "agreement_status":
      return "agreement status";
    case "expected_energisation":
      return "expected energisation";
    case "operational_status":
      return "operational status";
    case "commissioning_date":
      return "commissioning date";
    case "closure_date":
      return "closure date";
    case "power_mw":
      return "rated power (MW)";
    case "connection_capacity_mw":
      return "connection capacity (MW)";
    case "storage_energy_mwh":
      return "storage energy (MWh)";
    case "entity":
      return "record";
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

export function changeValueLabel(field: string, value: string | number | null): string {
  if (value === null) {
    return "not published";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (!isLabelledField(field)) {
    return value;
  }
  switch (field) {
    case "planning_status":
      return includes(PLANNING_STATUSES, value) ? planningLabel(value as PlanningStatus) : value;
    case "construction_status":
      return includes(CONSTRUCTION_STATUSES, value) ? constructionLabel(value as ConstructionStatus) : value;
    case "connection_stage":
      return includes(CONNECTION_STAGES, value) ? stageLabel(value as ConnectionStage) : value;
    case "connection_gate":
      return includes(CONNECTION_GATES, value) ? gateLabel(value as ConnectionGate) : value;
    case "agreement_status":
      return includes(AGREEMENT_STATUSES, value) ? agreementLabel(value as AgreementStatus) : value;
    case "operational_status":
      return includes(OPERATIONAL_STATUSES, value) ? operationalLabel(value as OperationalStatus) : value;
    case "planning_decision_date":
    case "construction_evidence_date":
    case "expected_energisation":
    case "commissioning_date":
    case "closure_date":
    case "power_mw":
    case "connection_capacity_mw":
    case "storage_energy_mwh":
    case "entity":
      return value;
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

export function changeSentence(event: ChangeEvent, name: string): string {
  switch (event.comparison) {
    case "not_in_release":
      return `${name} is in the earlier release and is not in the later release.`;
    case "correction":
      return `${name} ${changeFieldLabel(event.field)} was corrected from ${changeValueLabel(event.field, event.old)} to ${changeValueLabel(event.field, event.new)}.`;
    case "field":
      return `${name} ${changeFieldLabel(event.field)} changed from ${changeValueLabel(event.field, event.old)} to ${changeValueLabel(event.field, event.new)}.`;
    default: {
      const exhaustive: never = event.comparison;
      return exhaustive;
    }
  }
}

export function changeEvidence(event: ChangeEvent): string {
  return `Compared ${event.old_release_id} with ${event.new_release_id}.`;
}

export function changeStatusLine(superseded: boolean, supersedes: boolean): string | null {
  if (superseded) {
    return CHANGES_SUPERSEDED;
  }
  if (supersedes) {
    return CHANGES_SUPERSEDES;
  }
  return null;
}

type LabelledField = DiffField | "entity";

function isLabelledField(field: string): field is LabelledField {
  return field === "entity" || DIFF_FIELD_SET.has(field);
}

function includes(values: readonly string[], value: string): boolean {
  return values.includes(value);
}
