import { MAP_TITLE } from "@/lib/site";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 86_400;
export const alt = MAP_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

export default async function MapOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "map" }, snapshot);
}
