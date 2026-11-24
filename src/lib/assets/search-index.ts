import { ASSET_INDEX_PATH, decodeAssetIndex } from "@/lib/assets/index-file";
import type { AssetIndexRow } from "@/lib/assets/types";
import { fetchBoundedJson } from "@/lib/http/bounded-json";

let indexRequest: Promise<AssetIndexRow[]> | null = null;

export function resetSearchIndexCache(): void {
  indexRequest = null;
}

export function loadSearchIndex(fetchIndex: typeof fetch = fetch): Promise<AssetIndexRow[]> {
  if (!indexRequest) {
    const pending = fetchBoundedJson(ASSET_INDEX_PATH, undefined, fetchIndex)
      .then((body) => decodeAssetIndex(body))
      .catch((error: unknown) => {
        if (indexRequest === pending) {
          indexRequest = null;
        }
        throw error;
      });
    indexRequest = pending;
  }
  return indexRequest;
}
