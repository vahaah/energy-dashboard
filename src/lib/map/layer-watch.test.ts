import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readDnoLayerFlag, type LayerPointer } from "@/lib/map/layer-flag";
import { decideLayerWatch, runDnoLayerWatch, selectDnoGeoJsonResource } from "@/lib/map/layer-watch";
import { REDIS_DNO_POINTER_KEY } from "@/lib/map/constants";
import { resetRedisClient, setRedisForTests, type RedisCommands } from "@/lib/redis-cache";

const PUBLISHED: LayerPointer = {
  layer_id: "dno",
  edition: "20240503",
  url: "https://grid.vahaah.com/tiles/layers/dno/20240503.geojson",
  sha256: "sha256:45706a2dd90ea9f763df84fe916042074a113fa28da8597430d583f128398c89",
  bytes: 338625,
  source_url: "https://api.neso.energy/dataset/dno/download/gb-dno.geojson",
  source_etag: '"ecc3154f3f798b23ae2d40dedf2c548b"',
  source_sha256: "sha256:871d0b42c05fef95e2f3d4db2393be969489fbca45079bf83d96d160643ca5c2",
  status: "current",
  checked_at: "2026-10-15T00:22:01.948Z",
};

function memoryRedis(initial?: LayerPointer): RedisCommands & { sets: number; value: string | null } {
  let value = initial ? JSON.stringify(initial) : null;
  const redis = {
    sets: 0,
    get value() {
      return value;
    },
    async get<T>() {
      return (value ? (JSON.parse(value) as T) : null);
    },
    async set(_key: string, next: unknown) {
      redis.sets += 1;
      value = typeof next === "string" ? next : JSON.stringify(next);
      return "OK" as const;
    },
    async del() {
      value = null;
      return 1;
    },
    async incr() {
      return 1;
    },
    async expire() {
      return 1;
    },
  };
  return redis;
}

describe("DNO layer watch", () => {
  afterEach(() => {
    resetRedisClient();
  });

  it("picks the latest GeoJSON resource", () => {
    const selected = selectDnoGeoJsonResource([
      { format: "GeoJSON", name: "GB DNO Licence Areas 20200506 with GeoJson", url: "https://api.neso.energy/old.geojson" },
      { format: "ZIP", name: "shapefile", url: "https://api.neso.energy/old.zip" },
      {
        format: "GeoJSON",
        name: "GB DNO Licence Areas 20240503 with GeoJson",
        url: "https://api.neso.energy/new.geojson",
      },
    ]);
    expect(selected.url).toBe("https://api.neso.energy/new.geojson");
  });

  it("keeps the published pointer when the ETag matches and does not require a download", () => {
    const decision = decideLayerWatch(
      PUBLISHED,
      {
        sourceUrl: PUBLISHED.source_url,
        etag: "W/\"ecc3154f3f798b23ae2d40dedf2c548b\"",
        sha256: null,
        downloaded: false,
      },
      "2026-10-16T05:20:00.000Z",
    );
    expect(decision.action).toBe("keep");
    expect(decision.downloaded).toBe(false);
    expect(decision.pointer.sha256).toBe(PUBLISHED.sha256);
    expect(decision.pointer.url).toBe(PUBLISHED.url);
    expect(decision.pointer.status).toBe("current");
  });

  it("flags a new source hash and leaves the published url in place", () => {
    const decision = decideLayerWatch(
      PUBLISHED,
      {
        sourceUrl: PUBLISHED.source_url,
        etag: '"changed"',
        sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        downloaded: true,
      },
      "2026-10-16T05:20:00.000Z",
    );
    expect(decision.action).toBe("flag");
    expect(decision.pointer.status).toBe("changed");
    expect(decision.pointer.url).toBe(PUBLISHED.url);
    expect(decision.pointer.sha256).toBe(PUBLISHED.sha256);
    expect(decision.pointer.edition).toBe(PUBLISHED.edition);
    expect(decision.pointer.source_sha256).toBe(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("does not write the pointer when the source read fails", async () => {
    const redis = memoryRedis(PUBLISHED);
    const result = await runDnoLayerWatch({
      now: new Date("2026-10-16T05:20:00.000Z"),
      redis,
      fetchImpl: async () => new Response("nope", { status: 503 }),
    });
    expect(result.ok).toBe(false);
    expect(result.persisted).toBe(false);
    expect(redis.sets).toBe(0);
    expect(JSON.parse(redis.value ?? "{}")).toMatchObject({ sha256: PUBLISHED.sha256, status: "current" });
  });

  it("does not write when the pointer read fails", async () => {
    const redis = memoryRedis(PUBLISHED);
    redis.get = async () => {
      throw new Error("redis down");
    };
    const result = await runDnoLayerWatch({
      now: new Date("2026-10-16T05:20:00.000Z"),
      redis,
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("package_show")) {
          return Response.json({
            success: true,
            result: {
              resources: [
                {
                  format: "GeoJSON",
                  name: "GB DNO Licence Areas 20240503 with GeoJson",
                  url: PUBLISHED.source_url,
                },
              ],
            },
          });
        }
        if (url === PUBLISHED.source_url) {
          return new Response(null, { status: 302, headers: { location: "https://files.example/dno.geojson" } });
        }
        return new Response(null, { status: 304, headers: { etag: PUBLISHED.source_etag ?? "" } });
      },
    });
    expect(result.ok).toBe(false);
    expect(result.persisted).toBe(false);
    expect(redis.sets).toBe(0);
  });

  it("reads a changed flag and never writes on that read", async () => {
    const changed: LayerPointer = { ...PUBLISHED, status: "changed" };
    const redis = memoryRedis(changed);
    setRedisForTests(redis);
    const flag = await readDnoLayerFlag();
    expect(flag?.status).toBe("changed");
    expect(redis.sets).toBe(0);
    const reader = readFileSync(resolve(process.cwd(), "src/lib/map/layer-flag.ts"), "utf8");
    expect(reader).not.toContain(".set(");
    expect(reader).not.toContain("readFileSync");
    expect(reader).not.toContain("queryPipe");
    const watch = readFileSync(resolve(process.cwd(), "src/lib/map/layer-watch.ts"), "utf8");
    expect(watch).not.toContain("queryPipe");
    expect(watch).not.toContain("@/lib/tinybird");
  });

  it("stores the key the cron writes", () => {
    expect(REDIS_DNO_POINTER_KEY).toBe("grid:map-layer:dno");
  });
});
