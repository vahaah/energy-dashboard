import { GAS_SYSTEM_TITLE } from "@/lib/gas/copy";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 900;
export const alt = GAS_SYSTEM_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

export default async function GasOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "gas-system" }, snapshot);
}
