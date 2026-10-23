import type { PipelineFigures } from "@/lib/pipeline/model";
import { PIPELINE_STAGES } from "@/lib/pipeline/model";

export type TodayPipelineFigures = {
  gw: string | null;
  sites: number | null;
  missing: number;
  filtered: boolean;
  stages: { id: string; gw: string | null; sites: number }[];
};

/**
 * Home pipeline block. Same figures as /pipeline: revised records and records
 * with no application required are already out of `buildPipelineFigures`.
 */
export function todayPipelineFromFigures(figures: PipelineFigures): TodayPipelineFigures {
  const stages = PIPELINE_STAGES.map((id) => {
    const stage = figures.stages.find((row) => row.id === id);
    const sites = stage?.projects ?? 0;
    const gw = stage && stage.gw !== "0.0" && sites > 0 ? stage.gw : null;
    return { id, gw, sites };
  }).filter((row) => row.sites > 0);

  const hasProjects = figures.projects > 0;
  return {
    gw: hasProjects && figures.totalGw !== "0.0" ? figures.totalGw : null,
    sites: hasProjects ? figures.projects : null,
    missing: figures.missingCapacity,
    filtered: true,
    stages,
  };
}
