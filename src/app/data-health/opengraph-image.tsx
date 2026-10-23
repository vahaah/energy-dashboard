import { DATA_HEALTH_TITLE } from "@/lib/site";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 86_400;
export const alt = DATA_HEALTH_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function DataHealthOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "data-health" });
}
