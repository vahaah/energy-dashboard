import { canonicalJson } from "@/lib/catalogue/canonical";
import type { ChangeEvent, EnergyProject } from "@/lib/projects/schema";

export const DIFF_FIELDS = [
  "planning_status",
  "planning_decision_date",
  "construction_status",
  "construction_evidence_date",
  "connection_stage",
  "connection_gate",
  "agreement_status",
  "expected_energisation",
  "operational_status",
  "commissioning_date",
  "closure_date",
  "power_mw",
  "connection_capacity_mw",
  "storage_energy_mwh",
] as const;

export type DiffField = (typeof DIFF_FIELDS)[number];

export type ProjectSnapshotRow = {
  entity: string;
  release_id: string;
} & Record<DiffField, string | number | null>;

const DATED_FIELDS = new Set<DiffField>([
  "planning_decision_date",
  "construction_evidence_date",
  "expected_energisation",
  "commissioning_date",
  "closure_date",
]);

function isDate(value: string | number | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function same(left: string | number | null, right: string | number | null): boolean {
  return left === right;
}

/**
 * Field-by-field snapshot diff. A row present only in the older snapshot is
 * `not_in_release`. The word cancelled is never written.
 */
export function diffProjectSnapshots(
  older: readonly ProjectSnapshotRow[],
  newer: readonly ProjectSnapshotRow[],
  observedAt: string,
): ChangeEvent[] {
  const oldByEntity = index(older);
  const newByEntity = index(newer);
  const entities = [...new Set([...oldByEntity.keys(), ...newByEntity.keys()])].sort();
  const events: ChangeEvent[] = [];
  for (const entity of entities) {
    const previous = oldByEntity.get(entity);
    const next = newByEntity.get(entity);
    if (previous && !next) {
      events.push({
        entity,
        observed_at: observedAt,
        effective_at: null,
        old: previous.operational_status,
        new: null,
        old_release_id: previous.release_id,
        new_release_id: previous.release_id,
        comparison: "not_in_release",
        field: "entity",
      });
      continue;
    }
    if (!previous && next) {
      events.push({
        entity,
        observed_at: observedAt,
        effective_at: null,
        old: null,
        new: next.operational_status,
        old_release_id: next.release_id,
        new_release_id: next.release_id,
        comparison: "field",
        field: "entity",
      });
      continue;
    }
    if (!previous || !next) {
      continue;
    }
    for (const field of DIFF_FIELDS) {
      if (same(previous[field], next[field])) {
        continue;
      }
      const value = next[field];
      events.push({
        entity,
        observed_at: observedAt,
        effective_at: DATED_FIELDS.has(field) && isDate(value) ? value : null,
        old: previous[field],
        new: value,
        old_release_id: previous.release_id,
        new_release_id: next.release_id,
        comparison: "field",
        field,
      });
    }
  }
  return events;
}

export function projectSnapshotReleaseId(project: EnergyProject, fallback: string): string {
  return project.connection_release_id ?? project.operational_release_id ?? project.planning_release_id ?? fallback;
}

export function projectToSnapshot(project: EnergyProject, releaseId: string): ProjectSnapshotRow {
  return {
    entity: project.project_id,
    release_id: releaseId,
    planning_status: project.planning_status,
    planning_decision_date: project.planning_decision_date,
    construction_status: project.construction_status,
    construction_evidence_date: project.construction_evidence_date,
    connection_stage: project.connection_stage,
    connection_gate: project.connection_gate,
    agreement_status: project.agreement_status,
    expected_energisation: project.expected_energisation,
    operational_status: project.operational_status,
    commissioning_date: project.commissioning_date,
    closure_date: project.closure_date,
    power_mw: project.power_mw,
    connection_capacity_mw: project.connection_capacity_mw,
    storage_energy_mwh: project.storage_energy_mwh,
  };
}

/** Diff the register about to be replaced. A missing previous file records no events. */
export function diffAgainstPrevious(
  previous: readonly EnergyProject[] | null,
  next: readonly EnergyProject[],
  nextReleaseId: string,
  observedAt: string,
): ChangeEvent[] {
  if (previous === null) {
    return [];
  }
  return diffProjectSnapshots(
    previous.map((project) => projectToSnapshot(project, projectSnapshotReleaseId(project, nextReleaseId))),
    next.map((project) => projectToSnapshot(project, nextReleaseId)),
    observedAt,
  );
}

function index(rows: readonly ProjectSnapshotRow[]): Map<string, ProjectSnapshotRow> {
  const map = new Map<string, ProjectSnapshotRow>();
  const ordered = [...rows].sort((left, right) => left.entity.localeCompare(right.entity));
  for (const row of ordered) {
    map.set(row.entity, row);
  }
  return map;
}

export function serialiseChangeEvents(events: readonly ChangeEvent[], observedAt: string): string {
  return `${canonicalJson({
    catalogue_schema_version: 1,
    observed_at: observedAt,
    events,
  })}\n`;
}
