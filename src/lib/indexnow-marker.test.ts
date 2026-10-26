import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  INDEXNOW_MARKER_FILE_ENV,
  INDEXNOW_MARKER_KEY,
  fileIndexNowMarkerStore,
  indexNowMarkerStoreFromBodies,
  parseIndexNowMarker,
  redisIndexNowMarkerStore,
  resolveIndexNowMarkerStore,
} from "@/lib/indexnow-marker";
import { setRedisForTests, type RedisCommands } from "@/lib/redis-cache";

afterEach(() => {
  setRedisForTests(null);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env[INDEXNOW_MARKER_FILE_ENV];
});

describe("IndexNow marker", () => {
  it("parses per-stream checkpoints and does not apply a legacy watermark", () => {
    expect(parseIndexNowMarker(null)).toBeNull();
    expect(parseIndexNowMarker("")).toBeNull();
    expect(parseIndexNowMarker("2026-10-26T00:00:00.000Z")).toEqual({ streams: {} });
    expect(parseIndexNowMarker('{"lastmod":"2026-10-26T01:00:00.000Z"}\n')).toEqual({ streams: {} });
    expect(parseIndexNowMarker({ lastmod: "2026-10-26T02:00:00.000Z" })).toEqual({ streams: {} });
    expect(
      parseIndexNowMarker({
        streams: { "https://grid.vahaah.com/sitemap/assets.xml": "2026-08-03T09:00:03.000Z" },
      }),
    ).toEqual({
      streams: { "https://grid.vahaah.com/sitemap/assets.xml": "2026-08-03T09:00:03.000Z" },
    });
    expect(() => parseIndexNowMarker("not-a-date")).toThrow(/invalid/);
    expect(() => parseIndexNowMarker({ lastmod: 1 })).toThrow(/invalid/);
    expect(() => parseIndexNowMarker({ streams: { assets: "nope" } })).toThrow(/invalid/);
  });

  it("round-trips the Redis high-water mark", async () => {
    delete process.env[INDEXNOW_MARKER_FILE_ENV];
    const values = new Map<string, unknown>();
    const redis: RedisCommands = {
      get: async <T>(key: string) => (values.get(key) ?? null) as T | null,
      set: async (key, value) => {
        values.set(key, value);
        return "OK";
      },
      del: async () => 0,
      incr: async () => 1,
      expire: async () => 1,
    };
    setRedisForTests(redis);
    const store = resolveIndexNowMarkerStore();
    expect(store).not.toBeNull();
    expect(await store?.read()).toBeNull();
    await store?.write({
      streams: { "https://grid.vahaah.com/sitemap/pages.xml": "2026-10-26T03:00:00.000Z" },
    });
    expect(values.get(INDEXNOW_MARKER_KEY)).toBe(
      '{"streams":{"https://grid.vahaah.com/sitemap/pages.xml":"2026-10-26T03:00:00.000Z"}}',
    );
    expect(await redisIndexNowMarkerStore(redis).read()).toEqual({
      streams: { "https://grid.vahaah.com/sitemap/pages.xml": "2026-10-26T03:00:00.000Z" },
    });
  });

  it("round-trips the Blob JSON body", async () => {
    let body: string | null = null;
    const store = indexNowMarkerStoreFromBodies(
      async () => body,
      async (next) => {
        body = next;
      },
    );
    expect(await store.read()).toBeNull();
    await store.write({
      streams: { "https://grid.vahaah.com/sitemap/projects.xml": "2026-10-26T04:00:00.000Z" },
    });
    expect(body).toBe('{"streams":{"https://grid.vahaah.com/sitemap/projects.xml":"2026-10-26T04:00:00.000Z"}}\n');
    expect(await store.read()).toEqual({
      streams: { "https://grid.vahaah.com/sitemap/projects.xml": "2026-10-26T04:00:00.000Z" },
    });
  });

  it("is unset when neither Redis nor Blob is configured", () => {
    setRedisForTests(null);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env[INDEXNOW_MARKER_FILE_ENV];
    expect(resolveIndexNowMarkerStore()).toBeNull();
  });

  it("reads a missing file as null and prefers that file over Redis", async () => {
    const dir = await mkdtemp(join(tmpdir(), "indexnow-marker-"));
    const path = join(dir, "nested", "marker.json");
    const values = new Map<string, unknown>();
    try {
      expect(await fileIndexNowMarkerStore(path).read()).toBeNull();
      process.env[INDEXNOW_MARKER_FILE_ENV] = path;
      setRedisForTests({
        get: async <T>() => null as T | null,
        set: async (key, value) => {
          values.set(key, value);
          return "OK";
        },
        del: async () => 0,
        incr: async () => 1,
        expire: async () => 1,
      });
      const store = resolveIndexNowMarkerStore();
      expect(store).not.toBeNull();
      await store?.write({
        streams: { "https://grid.vahaah.com/sitemap/pages.xml": "2026-10-26T05:00:00.000Z" },
      });
      expect(values.size).toBe(0);
      expect(await readFile(path, "utf8")).toBe(
        '{"streams":{"https://grid.vahaah.com/sitemap/pages.xml":"2026-10-26T05:00:00.000Z"}}\n',
      );
      expect(await store?.read()).toEqual({
        streams: { "https://grid.vahaah.com/sitemap/pages.xml": "2026-10-26T05:00:00.000Z" },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
