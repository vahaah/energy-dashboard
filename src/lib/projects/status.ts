import { DISPLAY_STAGE_RULE } from "@/lib/projects/copy";

export const PLANNING_STATUSES = [
  "unknown",
  "pre_application",
  "application_submitted",
  "granted",
  "refused",
  "appeal_lodged",
  "appeal_withdrawn",
  "withdrawn",
  "abandoned",
  "expired",
  "no_application_required",
  "revised",
] as const;

export type PlanningStatus = (typeof PLANNING_STATUSES)[number];

export const CONSTRUCTION_STATUSES = ["unknown", "not_started", "under_construction", "built"] as const;

export type ConstructionStatus = (typeof CONSTRUCTION_STATUSES)[number];

export const CONNECTION_STAGES = ["unknown", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export type ConnectionStage = (typeof CONNECTION_STAGES)[number];

export const CONNECTION_GATES = ["unknown", "gate_1", "gate_2"] as const;

export type ConnectionGate = (typeof CONNECTION_GATES)[number];

export const AGREEMENT_STATUSES = ["unknown", "held", "connected"] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const OPERATIONAL_STATUSES = ["unknown", "proposed", "commissioning", "operational", "closed"] as const;

export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export const DISPLAY_STAGES = [
  "unknown",
  "proposed",
  "in_planning",
  "planning_refused",
  "withdrawn",
  "abandoned",
  "expired",
  "consented",
  "under_construction",
  "operational",
  "closed",
] as const;

export type DisplayStage = (typeof DISPLAY_STAGES)[number];

export type StatusAxes = {
  planning_status: PlanningStatus;
  construction_status: ConstructionStatus;
  operational_status: OperationalStatus;
};

const PLANNING_RANK: Record<PlanningStatus, number> = {
  unknown: 0,
  pre_application: 1,
  revised: 2,
  application_submitted: 3,
  appeal_lodged: 4,
  appeal_withdrawn: 5,
  withdrawn: 5,
  abandoned: 5,
  expired: 6,
  no_application_required: 7,
  refused: 8,
  granted: 9,
};

const CONSTRUCTION_RANK: Record<ConstructionStatus, number> = {
  unknown: 0,
  not_started: 1,
  under_construction: 2,
  built: 3,
};

const OPERATIONAL_RANK: Record<OperationalStatus, number> = {
  unknown: 0,
  proposed: 1,
  commissioning: 2,
  operational: 3,
  closed: 4,
};

export function furtherPlanning(current: PlanningStatus, next: PlanningStatus): PlanningStatus {
  return PLANNING_RANK[next] > PLANNING_RANK[current] ? next : current;
}

export function furtherConstruction(current: ConstructionStatus, next: ConstructionStatus): ConstructionStatus {
  return CONSTRUCTION_RANK[next] > CONSTRUCTION_RANK[current] ? next : current;
}

export function furtherOperational(current: OperationalStatus, next: OperationalStatus): OperationalStatus {
  return OPERATIONAL_RANK[next] > OPERATIONAL_RANK[current] ? next : current;
}

/**
 * display-stage.v1
 * Operational and construction facts win over planning.
 * A planning status of unknown never becomes planning_refused.
 */
export function deriveDisplayStage(axes: StatusAxes): DisplayStage {
  switch (axes.operational_status) {
    case "closed":
      return "closed";
    case "operational":
      return "operational";
    case "commissioning":
      return "under_construction";
    case "unknown":
    case "proposed":
      break;
    default: {
      const neverStatus: never = axes.operational_status;
      return neverStatus;
    }
  }

  if (axes.construction_status === "under_construction") {
    return "under_construction";
  }

  switch (axes.planning_status) {
    case "refused":
      return "planning_refused";
    case "granted":
    case "no_application_required":
      return "consented";
    case "expired":
      return "expired";
    case "application_submitted":
    case "appeal_lodged":
    case "pre_application":
    case "revised":
      return "in_planning";
    case "withdrawn":
    case "appeal_withdrawn":
      return "withdrawn";
    case "abandoned":
      return "abandoned";
    case "unknown":
      break;
    default: {
      const neverStatus: never = axes.planning_status;
      return neverStatus;
    }
  }

  if (axes.operational_status === "proposed" || axes.construction_status === "not_started" || axes.construction_status === "built") {
    return "proposed";
  }
  return "unknown";
}

export function displayStageRule(): typeof DISPLAY_STAGE_RULE {
  return DISPLAY_STAGE_RULE;
}

export function isPlanningStatus(value: string): value is PlanningStatus {
  return (PLANNING_STATUSES as readonly string[]).includes(value);
}

export function isDisplayStage(value: string): value is DisplayStage {
  return (DISPLAY_STAGES as readonly string[]).includes(value);
}

export function planningLabel(status: PlanningStatus): string {
  switch (status) {
    case "unknown":
      return "Unknown";
    case "pre_application":
      return "Pre-application";
    case "application_submitted":
      return "Application submitted";
    case "granted":
      return "Granted";
    case "refused":
      return "Refused";
    case "appeal_lodged":
      return "Appeal lodged";
    case "appeal_withdrawn":
      return "Appeal withdrawn";
    case "withdrawn":
      return "Withdrawn";
    case "abandoned":
      return "Abandoned";
    case "expired":
      return "Permission expired";
    case "no_application_required":
      return "No application required";
    case "revised":
      return "Revised";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function constructionLabel(status: ConstructionStatus): string {
  switch (status) {
    case "unknown":
      return "Unknown";
    case "not_started":
      return "Not started";
    case "under_construction":
      return "Under construction";
    case "built":
      return "Built";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function gateLabel(gate: ConnectionGate): string {
  switch (gate) {
    case "unknown":
      return "Unknown";
    case "gate_1":
      return "Gate 1";
    case "gate_2":
      return "Gate 2";
    default: {
      const neverGate: never = gate;
      return neverGate;
    }
  }
}

export function stageLabel(stage: ConnectionStage): string {
  if (stage === "unknown") {
    return "Unknown";
  }
  return `Stage ${stage}`;
}

export function agreementLabel(status: AgreementStatus): string {
  switch (status) {
    case "unknown":
      return "Unknown";
    case "held":
      return "Agreement held";
    case "connected":
      return "Connected";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function operationalLabel(status: OperationalStatus): string {
  switch (status) {
    case "unknown":
      return "Unknown";
    case "proposed":
      return "Proposed";
    case "commissioning":
      return "Commissioning";
    case "operational":
      return "Operational";
    case "closed":
      return "Closed";
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function displayStageLabel(stage: DisplayStage): string {
  switch (stage) {
    case "unknown":
      return "Unknown";
    case "proposed":
      return "Proposed";
    case "in_planning":
      return "In planning";
    case "planning_refused":
      return "Planning refused";
    case "withdrawn":
      return "Withdrawn";
    case "abandoned":
      return "Abandoned";
    case "expired":
      return "Permission expired";
    case "consented":
      return "Consented";
    case "under_construction":
      return "Under construction";
    case "operational":
      return "Operational";
    case "closed":
      return "Closed";
    default: {
      const neverStage: never = stage;
      return neverStage;
    }
  }
}
