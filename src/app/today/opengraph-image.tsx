import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 3600;
export const alt = "GB electricity today: mix, carbon and price | Grid";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TodayOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "today" });
}
