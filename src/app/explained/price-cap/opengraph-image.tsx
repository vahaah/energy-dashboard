import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 86_400;
export const alt = "Will energy bills go up in January 2027?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PriceCapOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "price-cap" });
}
