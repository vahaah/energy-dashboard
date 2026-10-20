import type { ProjectTechnology } from "@/lib/projects/technology";
import type {
  AgreementStatus,
  ConnectionGate,
  ConnectionStage,
  ConstructionStatus,
  OperationalStatus,
  PlanningStatus,
} from "@/lib/projects/status";

export type ProjectSourceId = "desnz-repd" | "neso-open-data";

/** One register row before merge and before the display stage is derived. */
export type SourceProject = {
  source_id: ProjectSourceId;
  external_ref: string;
  name: string;
  technology: ProjectTechnology;
  country: "England" | "Scotland" | "Wales" | null;
  region: string | null;
  planning_status: PlanningStatus;
  planning_decision_date: string | null;
  planning_source_id: ProjectSourceId | null;
  planning_release_id: string | null;
  construction_status: ConstructionStatus;
  construction_evidence_date: string | null;
  construction_source_id: ProjectSourceId | null;
  construction_release_id: string | null;
  connection_stage: ConnectionStage;
  connection_gate: ConnectionGate;
  agreement_status: AgreementStatus;
  expected_energisation: string | null;
  connection_source_id: ProjectSourceId | null;
  connection_release_id: string | null;
  operational_status: OperationalStatus;
  commissioning_date: string | null;
  closure_date: string | null;
  operational_source_id: ProjectSourceId | null;
  operational_release_id: string | null;
  power_mw: number | null;
  connection_capacity_mw: number | null;
  storage_energy_mwh: number | null;
};
