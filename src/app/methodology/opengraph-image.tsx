import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 86_400;
export const alt = "How Grid's numbers are made: sources and method";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function MethodologyOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "methodology" });
}
