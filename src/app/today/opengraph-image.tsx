import { renderOgImageResponse } from "@/lib/og/response";
import { TODAY_TITLE } from "@/lib/site";

export const revalidate = 3600;
export const alt = TODAY_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TodayOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "today" });
}
