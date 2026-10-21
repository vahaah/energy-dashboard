import { putImmutable } from "@/lib/blob-readback";
import {
  POSTCODE_LATEST_PATH,
  POSTCODE_PREVIOUS_PATH,
  postcodeImmutablePut,
  postcodeMutablePut,
  postcodeShardPath,
  type PostcodeObjectStore,
  type PostcodePointer,
} from "@/lib/postcode/blob";
import { splitNormalised } from "@/lib/postcode/parse";
import type { PostcodeRow } from "@/lib/postcode/rows";

export type PostcodeShard = {
  rows: Record<string, PostcodeRow>;
};

export function shardsFromRows(rows: ReadonlyMap<string, PostcodeRow>): Map<string, PostcodeShard> {
  const shards = new Map<string, PostcodeShard>();
  for (const [normalised, row] of rows) {
    const parsed = splitNormalised(normalised);
    if (!parsed) {
      continue;
    }
    const shard = shards.get(parsed.outward) ?? { rows: {} };
    shard.rows[parsed.inward] = row;
    shards.set(parsed.outward, shard);
  }
  return shards;
}

/**
 * Writes immutable shards, then moves the latest pointer. A shard that is
 * already stored is left as it is. The path is a hash of the outward code.
 */
export async function publishPostcodeRelease(
  store: PostcodeObjectStore,
  releaseId: string,
  rows: ReadonlyMap<string, PostcodeRow>,
  generatedAt: string,
): Promise<{ shards: number; pointer: PostcodePointer }> {
  const shards = shardsFromRows(rows);
  for (const [outward, shard] of shards) {
    const path = postcodeShardPath(releaseId, outward);
    await putImmutable(
      () => store.put(path, JSON.stringify(shard), postcodeImmutablePut()),
      async () => (await store.get(path)) != null,
    );
  }
  const current = await store.get(POSTCODE_LATEST_PATH);
  if (current) {
    await store.put(POSTCODE_PREVIOUS_PATH, current.body, postcodeMutablePut());
  }
  const pointer: PostcodePointer = { release_id: releaseId, generated_at: generatedAt };
  await store.put(POSTCODE_LATEST_PATH, JSON.stringify(pointer), postcodeMutablePut());
  return { shards: shards.size, pointer };
}
