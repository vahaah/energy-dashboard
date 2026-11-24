import { renderOgImageResponse } from "@/lib/og/response";
import { PRICE_CAP_TITLE } from "@/lib/site";

export const revalidate = 86_400;
export const alt = PRICE_CAP_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PriceCapOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "price-cap" });
}
