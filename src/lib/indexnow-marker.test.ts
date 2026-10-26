import { afterEach, describe, expect, it } from "vitest";
import {
  INDEXNOW_MARKER_KEY,
  indexNowMarkerStoreFromBodies,
  parseIndexNowMarker,
  redisIndexNowMarkerStore,
  resolveIndexNowMarkerStore,
} from "@/lib/indexnow-marker";
import { setRedisForTests, type RedisCommands } from "@/lib/redis-cache";

afterEach(() => {
  setRedisForTests(null);
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("IndexNow marker", () => {
  it("parses an ISO string or a JSON object and rejects anything else", () => {
    expect(parseIndexNowMarker(null)).toBeNull();
    expect(parseIndexNowMarker("")).toBeNull();
    expect(parseIndexNowMarker("2026-10-26T00:00:00.000Z")).toBe("2026-10-26T00:00:00.000Z");
    expect(parseIndexNowMarker('{"lastmod":"2026-10-26T01:00:00.000Z"}\n')).toBe("2026-10-26T01:00:00.000Z");
    expect(parseIndexNowMarker({ lastmod: "2026-10-26T02:00:00.000Z" })).toBe("2026-10-26T02:00:00.000Z");
    expect(() => parseIndexNowMarker("not-a-date")).toThrow(/invalid/);
    expect(() => parseIndexNowMarker({ lastmod: 1 })).toThrow(/invalid/);
  });

  it("round-trips the Redis high-water mark", async () => {
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
    await store?.write("2026-10-26T03:00:00.000Z");
    expect(values.get(INDEXNOW_MARKER_KEY)).toBe("2026-10-26T03:00:00.000Z");
    expect(await redisIndexNowMarkerStore(redis).read()).toBe("2026-10-26T03:00:00.000Z");
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
    await store.write("2026-10-26T04:00:00.000Z");
    expect(body).toBe('{"lastmod":"2026-10-26T04:00:00.000Z"}\n');
    expect(await store.read()).toBe("2026-10-26T04:00:00.000Z");
  });

  it("is unset when neither Redis nor Blob is configured", () => {
    setRedisForTests(null);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(resolveIndexNowMarkerStore()).toBeNull();
  });
});
