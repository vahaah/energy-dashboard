import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNdjson } from "@/lib/catalogue/load";
import {
  CHANGE_EVENTS_FILE,
  changeEventsFileSchema,
  energyProjectSchema,
  MERGES_FILE,
  PROJECTS_FILE,
  projectMergesSchema,
  type ChangeEventsFile,
  type EnergyProject,
  type ProjectMerges,
} from "@/lib/projects/schema";

export type ProjectCatalogue = {
  projects: EnergyProject[];
  byId: Map<string, EnergyProject>;
  merges: ProjectMerges;
  changes: ChangeEventsFile;
};

let cached: ProjectCatalogue | null = null;

function catalogueDir(cwd = process.cwd()): string {
  return join(cwd, "data", "catalogue");
}

export function loadProjectCatalogue(cwd = process.cwd()): ProjectCatalogue {
  if (cached && cwd === process.cwd()) {
    return cached;
  }
  const dir = catalogueDir(cwd);
  const parsed = parseNdjson(readFileSync(join(dir, PROJECTS_FILE), "utf8"), PROJECTS_FILE);
  if (!parsed.ok) {
    throw new Error(parsed.errors.join("\n"));
  }
  const projects = parsed.data.map((value) => energyProjectSchema.parse(value));
  const merges = projectMergesSchema.parse(JSON.parse(readFileSync(join(dir, MERGES_FILE), "utf8")));
  const changes = changeEventsFileSchema.parse(JSON.parse(readFileSync(join(dir, CHANGE_EVENTS_FILE), "utf8")));
  const catalogue = {
    projects,
    byId: new Map(projects.map((project) => [project.project_id, project])),
    merges,
    changes,
  };
  if (cwd === process.cwd()) {
    cached = catalogue;
  }
  return catalogue;
}

export function resetProjectCatalogueForTests(): void {
  cached = null;
}
