import { PIPELINE_TITLE } from "@/lib/pipeline/copy";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 86400;
export const alt = PIPELINE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

export default async function PipelineOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "pipeline" }, snapshot);
}
