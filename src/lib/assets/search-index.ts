import { ASSET_INDEX_PATH, decodeAssetIndex } from "@/lib/assets/index-file";
import type { AssetIndexRow } from "@/lib/assets/types";

let indexRequest: Promise<AssetIndexRow[]> | null = null;

export function resetSearchIndexCache(): void {
  indexRequest = null;
}

export function loadSearchIndex(fetchIndex: typeof fetch = fetch): Promise<AssetIndexRow[]> {
  if (!indexRequest) {
    const pending = fetchIndex(ASSET_INDEX_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`asset index ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
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
