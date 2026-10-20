import { PIPELINE_SOURCE_LINE } from "@/lib/pipeline/copy";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";
import { stageLabel, type PipelineStageId } from "@/lib/pipeline/model";

export type PipelineShare = {
  title: string;
  kicker: string;
  source: string;
  stamp: string;
};

export function pipelineStageSubline(stage: { id: PipelineStageId; gw: string }): string {
  switch (stage.id) {
    case "under_construction":
    case "in_planning":
      return `${stage.gw} GW ${stageLabel(stage.id).toLowerCase()}`;
    case "consented":
      return `${stage.gw} GW consented, not yet built`;
    default: {
      const neverStage: never = stage.id;
      return neverStage;
    }
  }
}

export function pipelineShare(): PipelineShare {
  const catalogue = loadPipelineCatalogue();
  const { figures, stamp } = catalogue;
  const count = figures.projects.toLocaleString("en-GB");
  return {
    title: `${figures.totalGw} GW · ${count} projects`,
    kicker: figures.stages.map((stage) => pipelineStageSubline(stage)).join(" · "),
    source: PIPELINE_SOURCE_LINE,
    stamp,
  };
}
