import { STORAGE_TITLE } from "@/lib/storage/copy";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { renderOgImageResponse } from "@/lib/og/response";

export const revalidate = 1800;
export const alt = STORAGE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const snapshot: OgCacheSnapshot = { facts: null, records: null, prices: null };

export default async function StorageOpenGraphImage() {
  return renderOgImageResponse({ kind: "page", page: "storage" }, snapshot);
}
