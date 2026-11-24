import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectCatalogue } from "../src/lib/projects/load";
import { projectPlace } from "../src/lib/projects/page-model";
import { displayStageLabel } from "../src/lib/projects/status";
import { technologyLabel } from "../src/lib/projects/technology";
import { encodeProjectIndex, type ProjectSearchRow } from "../src/lib/search/project-index";

const rows: ProjectSearchRow[] = loadProjectCatalogue().projects.map((project) => ({
  id: project.project_id,
  name: project.name,
  technology: technologyLabel(project.technology),
  stage: displayStageLabel(project.display_stage),
  place: project.country || project.region ? projectPlace(project.country, project.region) : "",
  mw: project.power_mw,
}));

const path = resolve("public/search/projects.json");
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, encodeProjectIndex(rows));
console.log(`wrote ${rows.length} projects to ${path}`);
