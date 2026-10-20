export const PIPELINE_PREVIEW_STATES = ["loading", "unavailable", "empty", "chart", "stale"] as const;

export type PipelinePreview = (typeof PIPELINE_PREVIEW_STATES)[number];

export function pipelinePreview(value: string | null): PipelinePreview | null {
  if (value === "loading" || value === "unavailable" || value === "empty" || value === "chart" || value === "stale") {
    return value;
  }
  return null;
}
