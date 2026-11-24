"use client";

import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import type { PipelineFigures, PipelineTableRow } from "@/lib/pipeline/model";
import { pipelinePreview } from "@/lib/pipeline/preview";

function previewFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }
  return pipelinePreview(new URLSearchParams(window.location.search).get("state"));
}

export function PipelineFrame({
  figures,
  stamp,
  stale,
  unavailable,
  pagedRows = null,
  facets = null,
}: {
  figures: PipelineFigures;
  stamp: string;
  stale: boolean;
  unavailable: boolean;
  pagedRows?: PipelineTableRow[] | null;
  facets?: { technologies: string[]; nations: string[]; total: number; pages: number } | null;
}) {
  const preview = previewFromLocation();
  return (
    <PipelineBoard
      figures={figures}
      stamp={stamp}
      stale={stale || preview === "stale"}
      unavailable={unavailable || preview === "unavailable"}
      preview={preview}
      pagedRows={pagedRows}
      facets={facets}
    />
  );
}
