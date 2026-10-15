import { WHOLE_ENERGY_TITLE } from "@/lib/whole-energy/copy";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 86400;
export const alt = WHOLE_ENERGY_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

export default async function WholeEnergyOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "whole-energy" }, snapshot);
}
