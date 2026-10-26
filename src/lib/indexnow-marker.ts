import { get, put } from "@vercel/blob";
import { blobReadSignal, readBlobResponse } from "@/lib/blob-read";
import { getRedis, type RedisCommands } from "@/lib/redis-cache";

/** High-water lastmod for IndexNow changed mode. Not a database. */
export const INDEXNOW_MARKER_KEY = "grid:indexnow:lastmod";
export const INDEXNOW_MARKER_PATH = "releases/indexnow/marker.json";

/** One checkpoint per sitemap child. A pages build time must not hide an older catalogue stream. */
export type IndexNowMarker = {
  streams: Record<string, string>;
};

export type IndexNowMarkerStore = {
  read(): Promise<IndexNowMarker | null>;
  write(marker: IndexNowMarker): Promise<void>;
};

export function formatIndexNowMarker(marker: IndexNowMarker): string {
  const streams: Record<string, string> = {};
  for (const key of Object.keys(marker.streams).sort()) {
    const value = marker.streams[key];
    if (value) streams[key] = value;
  }
  return JSON.stringify({ streams });
}

export function parseIndexNowMarker(value: unknown): IndexNowMarker | null {
  if (value == null || value === "") {
    return null;
  }
  const record = asRecord(value);
  if (!record) {
    throw new Error("marker: invalid");
  }
  if ("streams" in record) {
    return { streams: canonicalStreams(record.streams) };
  }
  // A single watermark from the first draft. It is not applied to every stream.
  if ("lastmod" in record) {
    assertInstant(record.lastmod);
    return { streams: {} };
  }
  throw new Error("marker: invalid");
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
    async write(marker: IndexNowMarker) {
      const canonical = parseIndexNowMarker(marker);
      if (!canonical) {
        throw new Error("marker: invalid");
      }
      const result = await redis.set(INDEXNOW_MARKER_KEY, formatIndexNowMarker(canonical));
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
    async write(marker: IndexNowMarker) {
      const canonical = parseIndexNowMarker(marker);
      if (!canonical) {
        throw new Error("marker: invalid");
      }
      await writeBody(`${formatIndexNowMarker(canonical)}\n`);
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    if (Number.isFinite(Date.parse(trimmed)) && !trimmed.startsWith("{")) {
      return { lastmod: trimmed };
    }
    try {
      return asRecord(JSON.parse(trimmed) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && value && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function canonicalStreams(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new Error("marker: invalid");
  }
  const streams: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    assertInstant(raw);
    streams[key] = new Date(Date.parse(raw)).toISOString();
  }
  return streams;
}

function assertInstant(value: unknown): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("marker: invalid");
  }
}
