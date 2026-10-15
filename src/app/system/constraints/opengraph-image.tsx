import { CONSTRAINTS_TITLE } from "@/lib/constraints/copy";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 3600;
export const alt = CONSTRAINTS_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

export default async function ConstraintsOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "constraints" }, snapshot);
}
