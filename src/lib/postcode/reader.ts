import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataState } from "@/lib/data-state";
import {
  POSTCODE_LATEST_PATH,
  parsePostcodePointer,
  postcodeShardPath,
  postcodeStore,
  type PostcodeObjectStore,
} from "@/lib/postcode/blob";
import { splitNormalised } from "@/lib/postcode/parse";
import { postcodeLookupFileSchema, postcodeRowSchema, type PostcodeRow } from "@/lib/postcode/rows";

export type PostcodeLookupHit = {
  available: true;
  row: PostcodeRow | null;
  state: DataState | null;
};

export type PostcodeLookup = PostcodeLookupHit | { available: false };

export type PostcodeReader = {
  lookup(normalised: string): Promise<PostcodeLookup>;
};

type ShardFile = {
  rows: Record<string, PostcodeRow>;
};

const shardCache = new Map<string, ShardFile>();
let pointerCache: string | null = null;

export function resetPostcodeReaderForTests(): void {
  shardCache.clear();
  pointerCache = null;
}

export function fixturePostcodeLookup(cwd = process.cwd()): Map<string, PostcodeRow> {
  const file = postcodeLookupFileSchema.parse(
    JSON.parse(readFileSync(join(cwd, "tests/fixtures/postcodes/lookup.json"), "utf8")),
  );
  return new Map(Object.entries(file.rows));
}

export function fixturePostcodeReader(cwd = process.cwd()): PostcodeReader {
  const rows = fixturePostcodeLookup(cwd);
  return {
    async lookup(normalised) {
      return { available: true, row: rows.get(normalised) ?? null, state: null };
    },
  };
}

function parseShard(body: string): ShardFile | null {
  try {
    const parsed = JSON.parse(body) as { rows?: unknown };
    if (!parsed.rows || typeof parsed.rows !== "object") {
      return null;
    }
    const rows: Record<string, PostcodeRow> = {};
    for (const [inward, value] of Object.entries(parsed.rows)) {
      const row = postcodeRowSchema.safeParse(value);
      if (!row.success) {
        return null;
      }
      rows[inward] = row.data;
    }
    return { rows };
  } catch {
    return null;
  }
}

async function readPointer(store: PostcodeObjectStore): Promise<{ releaseId: string; stale: boolean } | null> {
  try {
    const pointerFile = await store.get(POSTCODE_LATEST_PATH);
    if (!pointerFile) {
      return null;
    }
    const pointer = parsePostcodePointer(pointerFile.body);
    if (!pointer) {
      return pointerCache ? { releaseId: pointerCache, stale: true } : null;
    }
    pointerCache = pointer.release_id;
    return { releaseId: pointer.release_id, stale: false };
  } catch {
    return pointerCache ? { releaseId: pointerCache, stale: true } : null;
  }
}

export function blobPostcodeReader(store: PostcodeObjectStore = postcodeStore()): PostcodeReader {
  return {
    async lookup(normalised) {
      const parsed = splitNormalised(normalised);
      if (!parsed) {
        return { available: true, row: null, state: null };
      }
      const pointer = await readPointer(store);
      if (!pointer) {
        return { available: false };
      }
      const path = postcodeShardPath(pointer.releaseId, parsed.outward);
      try {
        const shardFile = await store.get(path);
        if (!shardFile) {
          return { available: true, row: null, state: pointer.stale ? "stale" : null };
        }
        const shard = parseShard(shardFile.body);
        if (!shard) {
          const cached = shardCache.get(path);
          if (cached) {
            return { available: true, row: cached.rows[parsed.inward] ?? null, state: "stale" };
          }
          return { available: false };
        }
        shardCache.set(path, shard);
        return {
          available: true,
          row: shard.rows[parsed.inward] ?? null,
          state: pointer.stale ? "stale" : null,
        };
      } catch {
        const cached = shardCache.get(path);
        if (cached) {
          return { available: true, row: cached.rows[parsed.inward] ?? null, state: "stale" };
        }
        return { available: false };
      }
    },
  };
}

/**
 * Lookup source. A deploy with `BLOB_READ_WRITE_TOKEN` reads Blob.
 * Tests, CI, and local builds leave the token unset and use the fixture.
 */
export function getPostcodeReader(): PostcodeReader {
  if (process.env.BLOB_READ_WRITE_TOKEN && !process.env.VITEST) {
    return blobPostcodeReader();
  }
  return fixturePostcodeReader();
}
