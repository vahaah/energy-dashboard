import { latestDate } from "@/lib/projects/dates";
import { projectIdForMembers } from "@/lib/projects/ids";
import type { EnergyProject, MergeDecision, ProjectMember, ProjectMerges } from "@/lib/projects/schema";
import type { SourceProject } from "@/lib/projects/source";
import {
  deriveDisplayStage,
  displayStageRule,
  furtherConstruction,
  furtherOperational,
  furtherPlanning,
} from "@/lib/projects/status";

const SUFFIX =
  /\b(ltd|limited|plc|llp|wind farm|windfarm|solar farm|solar park|bess|battery storage|energy storage system|energy storage)\b/g;

export function normaliseProjectName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(SUFFIX, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pairKey(repdRef: string, tecProjectId: string): string {
  return `${repdRef}\t${tecProjectId}`;
}

export function automaticNameLinks(repd: readonly SourceProject[], tec: readonly SourceProject[]): MergeDecision[] {
  const repdByName = groupUnique(repd.filter((row) => row.source_id === "desnz-repd"));
  const tecByName = groupUnique(tec.filter((row) => row.source_id === "neso-open-data"));
  const links: MergeDecision[] = [];
  for (const [name, repdRow] of repdByName) {
    const tecRow = tecByName.get(name);
    if (!tecRow || name.length < 10) {
      continue;
    }
    links.push({
      repd_ref: repdRow.external_ref,
      tec_project_id: tecRow.external_ref,
      method: "unique_name",
      note: "Unique normalised name on both registers.",
    });
  }
  links.sort((left, right) => pairKey(left.repd_ref, left.tec_project_id).localeCompare(pairKey(right.repd_ref, right.tec_project_id)));
  return links;
}

function groupUnique(rows: readonly SourceProject[]): Map<string, SourceProject> {
  const counts = new Map<string, number>();
  const first = new Map<string, SourceProject>();
  for (const row of rows) {
    const name = normaliseProjectName(row.name);
    if (name.length === 0) {
      continue;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!first.has(name)) {
      first.set(name, row);
    }
  }
  const unique = new Map<string, SourceProject>();
  for (const [name, count] of counts) {
    const row = first.get(name);
    if (count === 1 && row) {
      unique.set(name, row);
    }
  }
  return unique;
}

export function resolveLinks(
  automatic: readonly MergeDecision[],
  recorded: ProjectMerges,
): MergeDecision[] {
  const blocked = new Set(recorded.unlinks.map((link) => pairKey(link.repd_ref, link.tec_project_id)));
  const manual = recorded.links.filter((link) => link.method === "manual" && !blocked.has(pairKey(link.repd_ref, link.tec_project_id)));
  const seen = new Set(manual.map((link) => pairKey(link.repd_ref, link.tec_project_id)));
  const links = [...manual];
  for (const link of automatic) {
    const key = pairKey(link.repd_ref, link.tec_project_id);
    if (blocked.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    links.push(link);
  }
  links.sort((left, right) => pairKey(left.repd_ref, left.tec_project_id).localeCompare(pairKey(right.repd_ref, right.tec_project_id)));
  return links;
}

export function applyProjectMerges(
  repd: readonly SourceProject[],
  tec: readonly SourceProject[],
  merges: ProjectMerges,
): EnergyProject[] {
  const automatic = automaticNameLinks(repd, tec);
  const links = resolveLinks(automatic, merges);
  const repdByRef = new Map(repd.map((row) => [row.external_ref, row]));
  const tecById = new Map(tec.map((row) => [row.external_ref, row]));
  const usedRepd = new Set<string>();
  const usedTec = new Set<string>();
  const projects: EnergyProject[] = [];
  for (const link of links) {
    const left = repdByRef.get(link.repd_ref);
    const right = tecById.get(link.tec_project_id);
    if (!left || !right || usedRepd.has(left.external_ref) || usedTec.has(right.external_ref)) {
      continue;
    }
    usedRepd.add(left.external_ref);
    usedTec.add(right.external_ref);
    projects.push(finishProject(combine(left, right)));
  }
  for (const row of repd) {
    if (!usedRepd.has(row.external_ref)) {
      projects.push(finishProject(row));
    }
  }
  for (const row of tec) {
    if (!usedTec.has(row.external_ref)) {
      projects.push(finishProject(row));
    }
  }
  projects.sort((left, right) => left.project_id.localeCompare(right.project_id));
  return projects;
}

function combine(repd: SourceProject, tec: SourceProject): SourceProject & { members: ProjectMember[] } {
  const planningFromRepd = repd.planning_status !== "unknown";
  const constructionFromRepd = repd.construction_status !== "unknown";
  const operationalFromRepd = repd.operational_status !== "unknown";
  return {
    source_id: "desnz-repd",
    external_ref: repd.external_ref,
    name: repd.name.length >= tec.name.length ? repd.name : tec.name,
    technology: repd.technology === "unspecified" ? tec.technology : repd.technology,
    country: repd.country,
    planning_status: planningFromRepd ? repd.planning_status : furtherPlanning(repd.planning_status, tec.planning_status),
    planning_decision_date: planningFromRepd ? repd.planning_decision_date : tec.planning_decision_date,
    planning_source_id: planningFromRepd ? repd.planning_source_id : tec.planning_source_id,
    planning_release_id: planningFromRepd ? repd.planning_release_id : tec.planning_release_id,
    construction_status: constructionFromRepd
      ? repd.construction_status
      : furtherConstruction(repd.construction_status, tec.construction_status),
    construction_evidence_date: constructionFromRepd ? repd.construction_evidence_date : tec.construction_evidence_date,
    construction_source_id: constructionFromRepd ? repd.construction_source_id : tec.construction_source_id,
    construction_release_id: constructionFromRepd ? repd.construction_release_id : tec.construction_release_id,
    connection_stage: tec.connection_stage,
    connection_gate: tec.connection_gate,
    agreement_status: tec.agreement_status,
    expected_energisation: tec.expected_energisation,
    connection_source_id: tec.connection_source_id,
    connection_release_id: tec.connection_release_id,
    operational_status: operationalFromRepd
      ? repd.operational_status
      : furtherOperational(repd.operational_status, tec.operational_status),
    commissioning_date: operationalFromRepd ? repd.commissioning_date : latestDate([repd.commissioning_date, tec.commissioning_date]),
    closure_date: repd.closure_date ?? tec.closure_date,
    operational_source_id: operationalFromRepd ? repd.operational_source_id : tec.operational_source_id,
    operational_release_id: operationalFromRepd ? repd.operational_release_id : tec.operational_release_id,
    power_mw: repd.power_mw,
    connection_capacity_mw: tec.connection_capacity_mw,
    storage_energy_mwh: repd.storage_energy_mwh ?? tec.storage_energy_mwh,
    members: [
      { source_id: repd.source_id, external_ref: repd.external_ref },
      { source_id: tec.source_id, external_ref: tec.external_ref },
    ],
  };
}

function finishProject(row: SourceProject & { members?: ProjectMember[] }): EnergyProject {
  const members = row.members ?? [{ source_id: row.source_id, external_ref: row.external_ref }];
  const display_stage = deriveDisplayStage(row);
  return {
    project_id: projectIdForMembers(members),
    name: row.name,
    technology: row.technology,
    country: row.country,
    planning_status: row.planning_status,
    planning_decision_date: row.planning_decision_date,
    planning_source_id: row.planning_source_id,
    planning_release_id: row.planning_release_id,
    construction_status: row.construction_status,
    construction_evidence_date: row.construction_evidence_date,
    construction_source_id: row.construction_source_id,
    construction_release_id: row.construction_release_id,
    connection_stage: row.connection_stage,
    connection_gate: row.connection_gate,
    agreement_status: row.agreement_status,
    expected_energisation: row.expected_energisation,
    connection_source_id: row.connection_source_id,
    connection_release_id: row.connection_release_id,
    operational_status: row.operational_status,
    commissioning_date: row.commissioning_date,
    closure_date: row.closure_date,
    operational_source_id: row.operational_source_id,
    operational_release_id: row.operational_release_id,
    power_mw: row.power_mw,
    connection_capacity_mw: row.connection_capacity_mw,
    storage_energy_mwh: row.storage_energy_mwh,
    display_stage,
    display_stage_rule: displayStageRule(),
    members,
  };
}

export function emptyMerges(): ProjectMerges {
  return { catalogue_schema_version: 1, links: [], unlinks: [] };
}
