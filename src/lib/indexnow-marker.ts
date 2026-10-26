import { get, put } from "@vercel/blob";
import { blobReadSignal, readBlobResponse } from "@/lib/blob-read";
import { getRedis, type RedisCommands } from "@/lib/redis-cache";

/** High-water lastmod for IndexNow changed mode. Not a database. */
export const INDEXNOW_MARKER_KEY = "grid:indexnow:lastmod";
export const INDEXNOW_MARKER_PATH = "releases/indexnow/marker.json";

export type IndexNowMarkerStore = {
  read(): Promise<string | null>;
  write(lastmod: string): Promise<void>;
};

export function parseIndexNowMarker(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  const raw = markerText(value);
  if (raw == null || raw.length === 0) {
    throw new Error("marker: invalid");
  }
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) {
    throw new Error("marker: invalid");
  }
  return new Date(time).toISOString();
}

/** Redis when that pair is set, otherwise Blob. A missing store is null. */
export function resolveIndexNowMarkerStore(): IndexNowMarkerStore | null {
  const redis = getRedis();
  if (redis) {
    return redisIndexNowMarkerStore(redis);
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return blobIndexNowMarkerStore();
  }
  return null;
}

export function redisIndexNowMarkerStore(redis: RedisCommands): IndexNowMarkerStore {
  return {
    async read() {
      return parseIndexNowMarker(await redis.get<unknown>(INDEXNOW_MARKER_KEY));
    },
    async write(lastmod: string) {
      const canonical = parseIndexNowMarker(lastmod);
      if (!canonical) {
        throw new Error("marker: invalid");
      }
      const result = await redis.set(INDEXNOW_MARKER_KEY, canonical);
      if (result !== "OK") {
        throw new Error("marker: write failed");
      }
    },
  };
}

export function indexNowMarkerStoreFromBodies(
  readBody: () => Promise<string | null>,
  writeBody: (body: string) => Promise<void>,
): IndexNowMarkerStore {
  return {
    async read() {
      const body = await readBody();
      if (body == null || body.trim() === "") {
        return null;
      }
      return parseIndexNowMarker(body);
    },
    async write(lastmod: string) {
      const canonical = parseIndexNowMarker(lastmod);
      if (!canonical) {
        throw new Error("marker: invalid");
      }
      await writeBody(`${JSON.stringify({ lastmod: canonical })}\n`);
    },
  };
}

function blobIndexNowMarkerStore(): IndexNowMarkerStore {
  return indexNowMarkerStoreFromBodies(
    async () => {
      const stored = await readBlobResponse(() =>
        get(INDEXNOW_MARKER_PATH, {
          access: "public",
          useCache: false,
          abortSignal: blobReadSignal(),
        }),
      );
      return stored?.body ?? null;
    },
    async (body) => {
      await put(INDEXNOW_MARKER_PATH, body, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
    },
  );
}

function markerText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{")) {
      try {
        return markerText(JSON.parse(trimmed) as unknown);
      } catch {
        return null;
      }
    }
    return trimmed;
  }
  if (typeof value === "object" && value && "lastmod" in value) {
    const lastmod = (value as { lastmod: unknown }).lastmod;
    return typeof lastmod === "string" ? lastmod.trim() : null;
  }
  return null;
}
