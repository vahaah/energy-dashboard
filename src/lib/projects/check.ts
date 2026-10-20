import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNdjson } from "@/lib/catalogue/load";
import { projectIdForMembers } from "@/lib/projects/ids";
import {
  CHANGE_EVENTS_FILE,
  changeEventsFileSchema,
  energyProjectSchema,
  MERGES_FILE,
  PROJECTS_FILE,
  projectMergesSchema,
} from "@/lib/projects/schema";
import { deriveDisplayStage } from "@/lib/projects/status";
import { pairKey } from "@/lib/projects/merge";

const MW_MAX = 5_000;

export function checkProjectFiles(dir: string, options: { required: boolean }): string[] {
  const projectsPath = join(dir, PROJECTS_FILE);
  const mergesPath = join(dir, MERGES_FILE);
  const changesPath = join(dir, CHANGE_EVENTS_FILE);
  if (!existsSync(projectsPath) || !existsSync(mergesPath) || !existsSync(changesPath)) {
    return options.required ? [`missing ${PROJECTS_FILE}, ${MERGES_FILE}, or ${CHANGE_EVENTS_FILE}`] : [];
  }
  const errors: string[] = [];
  let text = "";
  try {
    text = readFileSync(projectsPath, "utf8");
  } catch {
    return [`missing ${PROJECTS_FILE}`];
  }
  if (text.includes("cancelled")) {
    errors.push(`${PROJECTS_FILE}: a disappearance must be not_in_release`);
  }
  const parsed = parseNdjson(text, PROJECTS_FILE);
  if (!parsed.ok) {
    return parsed.errors;
  }
  const ids = new Set<string>();
  for (const value of parsed.data) {
    const record = energyProjectSchema.safeParse(value);
    if (!record.success) {
      errors.push(
        `${PROJECTS_FILE}: ${record.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
      );
      continue;
    }
    const row = record.data;
    if (ids.has(row.project_id)) {
      errors.push(`${PROJECTS_FILE}: duplicate ${row.project_id}`);
    }
    ids.add(row.project_id);
    const expectedId = projectIdForMembers(row.members);
    if (row.project_id !== expectedId) {
      errors.push(`${PROJECTS_FILE}: ${row.project_id} id is not ${expectedId}`);
    }
    const stage = deriveDisplayStage(row);
    if (row.display_stage !== stage) {
      errors.push(`${PROJECTS_FILE}: ${row.project_id} display stage is not ${stage}`);
    }
    if (row.planning_status === "unknown" && row.display_stage === "planning_refused") {
      errors.push(`${PROJECTS_FILE}: ${row.project_id} treats unknown planning as refused`);
    }
    for (const field of ["power_mw", "connection_capacity_mw"] as const) {
      const mw = row[field];
      if (mw !== null && (mw < 0 || mw > MW_MAX)) {
        errors.push(`${PROJECTS_FILE}: ${row.project_id} ${field} is outside 0..${MW_MAX}`);
      }
    }
    if (row.storage_energy_mwh !== null && row.storage_energy_mwh < 0) {
      errors.push(`${PROJECTS_FILE}: ${row.project_id} storage energy is negative`);
    }
    const sources = row.members.map((member) => member.source_id);
    if (new Set(sources).size !== sources.length) {
      errors.push(`${PROJECTS_FILE}: ${row.project_id} repeats a source`);
    }
  }

  let mergesText = "";
  try {
    mergesText = readFileSync(mergesPath, "utf8");
  } catch {
    return [...errors, `missing ${MERGES_FILE}`];
  }
  const merges = projectMergesSchema.safeParse(JSON.parse(mergesText));
  if (!merges.success) {
    errors.push(`${MERGES_FILE}: ${merges.error.issues.map((issue) => issue.message).join("; ")}`);
  } else {
    const linked = new Set(merges.data.links.map((link) => pairKey(link.repd_ref, link.tec_project_id)));
    for (const unlink of merges.data.unlinks) {
      if (linked.has(pairKey(unlink.repd_ref, unlink.tec_project_id))) {
        errors.push(`${MERGES_FILE}: ${unlink.repd_ref} is both linked and unlinked`);
      }
    }
  }

  let changesText = "";
  try {
    changesText = readFileSync(changesPath, "utf8");
  } catch {
    return [...errors, `missing ${CHANGE_EVENTS_FILE}`];
  }
  if (changesText.toLowerCase().includes("cancelled")) {
    errors.push(`${CHANGE_EVENTS_FILE}: a disappearance must be not_in_release`);
  }
  const changes = changeEventsFileSchema.safeParse(JSON.parse(changesText));
  if (!changes.success) {
    errors.push(`${CHANGE_EVENTS_FILE}: ${changes.error.issues.map((issue) => issue.message).join("; ")}`);
  } else {
    for (const event of changes.data.events) {
      switch (event.comparison) {
        case "field":
        case "not_in_release":
        case "correction":
          break;
        default: {
          const comparison: never = event.comparison;
          errors.push(`${CHANGE_EVENTS_FILE}: ${event.entity} comparison is not a known method (${String(comparison)})`);
          break;
        }
      }
      if (event.old_release_id.length === 0 || event.new_release_id.length === 0) {
        errors.push(`${CHANGE_EVENTS_FILE}: ${event.entity} is missing a release id`);
      }
      if (event.old === "cancelled" || event.new === "cancelled") {
        errors.push(`${CHANGE_EVENTS_FILE}: ${event.entity} uses cancelled`);
      }
    }
  }
  return errors;
}
