import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 3600;
export const alt = "UK gas price today: SAP, Henry Hub, Europe, Japan LNG";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function GasOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "gas" });
}
