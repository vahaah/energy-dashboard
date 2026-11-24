import { NESO_OPEN_DATA_ATTRIBUTION, NESO_TEC_REGISTER_URL, OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import { formatGrouped } from "@/lib/format/quantity";

export const PROJECTS_PATH = "/projects";
export const PROJECTS_TITLE = "GB energy projects: planning and construction status | Grid";
export const PROJECTS_H1 = "What is being built, and how far has it got?";
export const PROJECTS_STANDFIRST =
  "Projects from public registers, with planning, construction and connection status shown separately.";

export function projectsDirectoryDescription(count: number): string {
  return `Track ${formatGrouped(count, 0)} GB energy projects through planning, construction and grid connection, from DESNZ REPD and the NESO TEC register, with each source dated.`;
}
export const PROJECTS_EYEBROW = "Projects";

export const PROJECT_PROFILE_STANDFIRST = "Where is it up to?";
export const PROJECT_PROFILE_SOURCE = "Each status below comes from a named source and date.";

export const PROJECT_EXPECTATION_CHANGE =
  "This is a change in the published expectation, not a confirmed commissioning date.";

export function projectProfileTitle(projectName: string): string {
  return `${projectName} | Grid`;
}

export function projectProfileH1(projectName: string): string {
  return projectName.replaceAll("Solar Pv", "solar PV");
}

export const RATED_POWER = "Rated power";
export const CONNECTION_CAPACITY = "Connection capacity";
export const STORAGE_ENERGY = "Storage energy";
export const OPERATING_RATED_POWER = "Operating rated power";

export const PROPOSED_EXCLUDED = "Proposed projects are left out of the operating total.";

export const CONNECTION_DUPLICATE_WARNING =
  "Capacity across stages and technology types is currently presented in aggregate, which may result in duplicate entries.";

export const STORAGE_ENERGY_UNPUBLISHED =
  "REPD and the TEC register publish rated power and connection capacity. They do not publish storage energy.";

export const DISPLAY_STAGE_RULE = "display-stage.v1";

export const PROJECTS_ATTRIBUTION = `${OGL_V3_ATTRIBUTION} ${NESO_OPEN_DATA_ATTRIBUTION}.`;

export const NO_DATE_PUBLISHED = "No date published";

export const TEC_REGISTER_URL = NESO_TEC_REGISTER_URL;

export const GATE_COLUMN_SINCE = "2025-11-21";
