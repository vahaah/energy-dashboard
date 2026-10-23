import { formatEnergy } from "@/lib/format/quantity";
import { fitDetailTitle } from "@/lib/seo/document-title";
import { clampDescription } from "@/lib/seo/detail";
import type { EnergyProject } from "@/lib/projects/schema";
import { constructionLabel, displayStageLabel, planningLabel } from "@/lib/projects/status";
import { technologyLabel } from "@/lib/projects/technology";

function calendarLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) {
    return day;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function projectSource(project: EnergyProject): string {
  const repd = project.members.some((member) => member.source_id === "desnz-repd");
  return repd ? "DESNZ REPD" : "the NESO TEC register";
}

export function projectSeoTitle(project: EnergyProject): string {
  const stage = displayStageLabel(project.display_stage).toLowerCase();
  return fitDetailTitle(project.name, stage);
}

export function projectSeoDescription(project: EnergyProject): string {
  const energy =
    project.power_mw != null && Number.isFinite(project.power_mw) && project.power_mw > 0
      ? formatEnergy(project.power_mw)
      : null;
  const technology = technologyLabel(project.technology);
  const sized = energy ? `a ${energy.value} ${energy.unit} ${technology}` : `a ${technology}`;
  const place = project.region?.trim() || project.country;
  const where = place ? ` in ${place}` : "";
  const planning = planningLabel(project.planning_status).toLowerCase();
  const when = project.planning_decision_date ? ` on ${calendarLabel(project.planning_decision_date)}` : "";
  const construction = constructionLabel(project.construction_status).toLowerCase();
  return clampDescription(
    `${project.name}, ${sized} project${where}: planning ${planning}${when}, construction ${construction}. Source: ${projectSource(project)}.`,
  );
}
