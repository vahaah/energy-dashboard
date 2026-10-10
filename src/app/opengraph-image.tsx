import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 86_400;
export const alt = "Grid — GB electricity dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return renderOgImageResponse({ kind: "focus", focus: "overview" });
}
