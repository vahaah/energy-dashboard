import { PIPELINE_SOURCE_LINE } from "@/lib/pipeline/copy";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";
import { stageLabel } from "@/lib/pipeline/model";

export type PipelineShare = {
  title: string;
  kicker: string;
  source: string;
  stamp: string;
};

export function pipelineShare(): PipelineShare {
  const catalogue = loadPipelineCatalogue();
  const { figures, stamp } = catalogue;
  const count = figures.projects.toLocaleString("en-GB");
  const split = figures.stages.map((stage) => `${stage.gw} GW ${stageLabel(stage.id).toLowerCase()}`).join(" · ");
  return {
    title: `${figures.totalGw} GW · ${count} projects`,
    kicker: split,
    source: PIPELINE_SOURCE_LINE,
    stamp,
  };
}
