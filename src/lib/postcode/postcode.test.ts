import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/postcode/route";
import { API_ERROR_SOURCE_UNAVAILABLE } from "@/lib/api/errors";
import { sha256Prefixed } from "@/lib/catalogue/canonical";
import {
  CI_REGION_CACHE_KEYS,
  CI_REGION_FRESH_MS,
  CI_REGION_RETAIN_SECONDS,
  CI_REGION_UPSTREAM_DAILY_CAP,
  ciRegionCacheKey,
  regionalIntensityUrl,
  type CiRegionId,
} from "@/lib/postcode/areas";
import { areaAnalyticsEvent, type AreaAnalyticsEvent } from "@/lib/postcode/analytics";
import {
  MemoryPostcodeStore,
  postcodeShardPath,
  setPostcodeStoreForTests,
  type PostcodeObjectStore,
} from "@/lib/postcode/blob";
import { buildPostcodeLookup } from "@/lib/postcode/build";
import {
  NSPL_PUBLISHED_AT,
  NSPL_RELEASE_CONTENT,
  commitPostcodeEdition,
  postcodeReleaseErrors,
} from "@/lib/postcode/catalogue";
import { indexFeatures, locate, type GeoJsonFeatureCollection } from "@/lib/postcode/geometry";
import { readRegionalIntensity, resetRegionalIntensityForTests } from "@/lib/postcode/intensity";
import { indexCarbonRegions, indexDnoAreas } from "@/lib/postcode/layers";
import { publishPostcodeRelease } from "@/lib/postcode/publish";
import { blobPostcodeReader, resetPostcodeReaderForTests, type PostcodeReader } from "@/lib/postcode/reader";
import { resolvePostcode, type PostcodeFoundBody, type PostcodeResolveResult } from "@/lib/postcode/resolve";
import type { PostcodeRow } from "@/lib/postcode/rows";
import { resetRedisClient, type RedisCommands } from "@/lib/redis-cache";

const INWARD = ["1AA", "1HQ", "7AA", "2HQ", "1BN", "0AA"];
const COMPACT = ["SW1A1AA", "SY11HQ", "SY107AA", "CH12HQ", "TD151BN", "W1A0AA"];
const SPACED = ["SW1A 1AA", "SY1 1HQ", "SY10 7AA", "CH1 2HQ", "TD15 1BN", "W1A 0AA"];

const POINTS = [
  { code: "SW1A 1AA", lon: -0.141563, lat: 51.50101, dno: "ukpn-london", ci: "13" },
  { code: "SY1 1HQ", lon: -2.756082, lat: 52.707766, dno: "nged-west-midlands", ci: "8" },
  { code: "SY10 7AA", lon: -3.050722, lat: 52.869936, dno: "spen-manweb", ci: "6" },
  { code: "CH1 2HQ", lon: -2.892988, lat: 53.192897, dno: "spen-manweb", ci: "6" },
  { code: "TD15 1BN", lon: -2.004049, lat: 55.770101, dno: "spen-distribution", ci: "2" },
] as const;

function intensityBody(regionId: number, forecast = 120) {
  return {
    data: [
      {
        regionid: regionId,
        data: [{ from: "2026-10-20T12:00Z", to: "2026-10-20T12:30Z", intensity: { forecast, index: "moderate" } }],
      },
    ],
  };
}

function okResponse(regionId: number, forecast = 120): Response {
  return new Response(JSON.stringify(intensityBody(regionId, forecast)), { status: 200 });
}

function square(id: string, name: string, minLon: number, minLat: number, maxLon: number, maxLat: number) {
  const ring = [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
  ];
  const indexed = indexFeatures([
    { id, name, geometry: { type: "Polygon", coordinates: [ring] } },
  ]);
  const feature = indexed[0];
  if (!feature) {
    throw new Error("square was not indexed");
  }
  return feature;
}

function linesOf(csv: string): AsyncIterable<string> {
  const lines = csv.split("\n");
  return {
    async *[Symbol.asyncIterator]() {
      for (const line of lines) {
        yield line;
      }
    },
  };
}

function found(result: PostcodeResolveResult): {
  http: 200;
  body: PostcodeFoundBody;
  analytics: AreaAnalyticsEvent | null;
} {
  if (result.http !== 200) {
    throw new Error("expected a found postcode");
  }
  if (result.body.status !== "found") {
    throw new Error("expected a found postcode");
  }
  return { http: 200, body: result.body, analytics: result.analytics };
}

function containsPostcode(value: unknown): boolean {
  const text = JSON.stringify(value);
  return [...INWARD, ...COMPACT, ...SPACED].some((token) => text.includes(token));
}

afterEach(() => {
  resetRegionalIntensityForTests();
  resetRedisClient();
  resetPostcodeReaderForTests();
  setPostcodeStoreForTests(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("carbon intensity cache", () => {
  it("uses fourteen region keys and a fourteen by forty-eight daily cap", () => {
    expect(CI_REGION_CACHE_KEYS).toHaveLength(14);
    expect(new Set(CI_REGION_CACHE_KEYS).size).toBe(14);
    expect(CI_REGION_CACHE_KEYS.every((key) => /^grid:ci-region:(?:[1-9]|1[0-4])$/.test(key))).toBe(true);
    expect(CI_REGION_UPSTREAM_DAILY_CAP).toBe(14 * 48);
    expect(CI_REGION_FRESH_MS).toBe(30 * 60 * 1000);
    expect(() => ciRegionCacheKey(15 as CiRegionId)).toThrow(/region id/);
    expect(() => ciRegionCacheKey(99 as CiRegionId)).toThrow(/region id/);
    expect(() => regionalIntensityUrl(15 as CiRegionId)).toThrow(/region id/);
    for (const file of [
      "src/lib/postcode/intensity.ts",
      "src/lib/postcode/http.ts",
      "src/lib/postcode/resolve.ts",
      "src/app/api/v1/postcode/route.ts",
    ]) {
      expect(readFileSync(resolve(process.cwd(), file), "utf8")).not.toContain("/regional/postcode");
    }
    expect(readFileSync(resolve(process.cwd(), "src/lib/postcode/resolve.ts"), "utf8")).not.toContain(
      "postcode/layers",
    );
  });
});

describe("DNO and carbon intensity layers", () => {
  const collection = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/tiles/layers/dno/20240503.geojson"), "utf8"),
  ) as GeoJsonFeatureCollection;
  const dno = indexDnoAreas(collection);
  const ci = indexCarbonRegions(collection);

  it("keeps carbon intensity names off the DNO area name", () => {
    const byDno = new Map(dno.map((feature) => [feature.id, feature.name]));
    const byCi = new Map(ci.map((feature) => [feature.id, feature.name]));
    expect(byDno.get("spen-distribution")).toBe("South and Central Scotland");
    expect(byCi.get("2")).toBe("South Scotland");
    expect(byDno.get("spen-manweb")).toBe("North Wales, Merseyside and Cheshire");
    expect(byCi.get("6")).toBe("North Wales & Merseyside");
    expect(byDno.get("ssen-southern")).toBe("Southern England");
    expect(byCi.get("12")).toBe("South England");
  });

  it("places the fixture postcodes, including the DNO boundary and the region that the authority does not suggest", () => {
    for (const point of POINTS) {
      const dnoHit = locate(dno, point.lon, point.lat);
      const ciHit = locate(ci, point.lon, point.lat);
      expect(dnoHit.kind, point.code).toBe("one");
      expect(ciHit.kind, point.code).toBe("one");
      if (dnoHit.kind === "one" && ciHit.kind === "one") {
        expect(dnoHit.feature.id, point.code).toBe(point.dno);
        expect(ciHit.feature.id, point.code).toBe(point.ci);
      }
    }
    const shropshire = POINTS.filter((point) => point.code.startsWith("SY"));
    expect(new Set(shropshire.map((point) => point.dno)).size).toBe(2);
    const chester = POINTS.find((point) => point.code.startsWith("CH1"));
    expect(chester?.ci).not.toBe("3");
    const northumberland = POINTS.find((point) => point.code.startsWith("TD15"));
    expect(northumberland?.ci).not.toBe("4");
  });

  it("can put one point in a DNO area and a different carbon intensity polygon", () => {
    const point = { lon: -1.5, lat: 52.5 };
    const dnoOnly = [square("custom-dno", "Custom DNO", -2, 52, -1, 53)];
    const ciOnly = [square("4", "Not The DNO", -2, 52, -1, 53)];
    const dnoHit = locate(dnoOnly, point.lon, point.lat);
    const ciHit = locate(ciOnly, point.lon, point.lat);
    expect(dnoHit.kind).toBe("one");
    expect(ciHit.kind).toBe("one");
    if (dnoHit.kind === "one" && ciHit.kind === "one") {
      expect(dnoHit.feature.name).not.toBe(ciHit.feature.name);
      expect(ciHit.feature.id).toBe("4");
    }
  });
});

describe("NSPL build", () => {
  const names = "LAD26CD,LAD26NM\nE06000051,Shropshire\nE09000033,Westminster\n";
  const dno = [
    square("spen-manweb", "North Wales, Merseyside and Cheshire", -3.2, 52.8, -2.9, 53.3),
    square("nged-west-midlands", "West Midlands", -2.9, 52.6, -2.5, 52.8),
    square("decoy", "Swapped", 52.8, -3.2, 53, -2.9),
    square("meridian", "Meridian", -0.1, 51.4, 0.1, 51.6),
  ];
  const ci = [
    square("6", "North Wales & Merseyside", -3.2, 52.8, -2.9, 53.3),
    square("8", "West Midlands", -2.9, 52.6, -2.5, 52.8),
    square("99", "Decoy region", 52.8, -3.2, 53, -2.9),
  ];

  it("stores the authority, the DNO, and the carbon region from separate inputs", async () => {
    const csv = [
      "pcds,doterm,lad26cd,ctry26cd,lat,long",
      "SY1 1HQ,,E06000051,E92000001,52.707766,-2.756082",
      "SY10 7AA,,E06000051,E92000001,52.869936,-3.050722",
      "BT1 1AA,,N09000003,N92000002,54.6,-5.9",
      "W1A 0AA,199812,E09000033,E92000001,51.517134,-0.134218",
      "AB1 0AA,not-a-date,E06000051,E92000001,52.7,-2.7",
      "SY2 1AA,,E06000051,E92000001,,",
      "N1 1AA,,E09000033,E92000001,0,0",
      "E1 1AA,,E09000033,E92000001,51.5,0",
    ].join("\n");
    const built = await buildPostcodeLookup({
      postcodeLines: linesOf(csv),
      authorityNamesCsv: names,
      dno,
      ci,
    });
    expect(built.rows.has("BT11AA")).toBe(false);
    expect(built.stats.omitted).toBe(1);
    expect(built.stats.quarantined).toBe(1);
    const sy1 = built.rows.get("SY11HQ");
    const sy10 = built.rows.get("SY107AA");
    expect(sy1?.la).toEqual({ code: "E06000051", name: "Shropshire" });
    expect(sy10?.la).toEqual(sy1?.la);
    expect(sy1?.dno?.id).toBe("nged-west-midlands");
    expect(sy10?.dno?.id).toBe("spen-manweb");
    expect(sy10?.dno?.id).not.toBe("decoy");
    expect(sy10?.ci).toEqual({ id: 6, name: "North Wales & Merseyside" });
    expect(sy1?.ci).toEqual({ id: 8, name: "West Midlands" });
    const terminated = built.rows.get("W1A0AA");
    expect(terminated?.terminated).toBe(true);
    expect(terminated?.dno).toBeNull();
    expect(terminated?.ci).toBeNull();
    expect(terminated?.la?.name).toBe("Westminster");
    const blank = built.rows.get("SY21AA");
    expect(blank?.la?.code).toBe("E06000051");
    expect(blank?.dno).toBeNull();
    expect(blank?.ci).toBeNull();
    expect(built.stats.unlocated).toBeGreaterThan(0);
    expect(built.rows.get("N11AA")?.dno).toBeNull();
    expect(built.rows.get("E11AA")?.dno?.id).toBe("meridian");
  });
});

describe("regional intensity", () => {
  it("sends the region id and never an inward code", async () => {
    const urls: string[] = [];
    const sleeps: number[] = [];
    const sets: { key: string; ex?: number }[] = [];
    const redis: RedisCommands = {
      async get() {
        return null;
      },
      async set(key, _value, opts) {
        sets.push({ key, ex: opts?.ex });
        return "OK";
      },
      async del() {
        return 0;
      },
      async incr() {
        return 1;
      },
      async expire() {
        return 1;
      },
    };
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      const id = Number(url.split("/").at(-1));
      return okResponse(id, 80);
    });
    let now = 1_700_000_000_000;
    const first = await readRegionalIntensity(6, {
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => now,
      redis,
    });
    const second = await readRegionalIntensity(6, {
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async () => undefined,
      now: () => now,
      redis,
    });
    expect(first.reading?.forecast).toBe(80);
    expect(second.reading?.forecast).toBe(80);
    expect(urls).toEqual(["https://api.carbonintensity.org.uk/regional/regionid/6"]);
    expect(containsPostcode(urls)).toBe(false);
    expect(sets.map((entry) => entry.key)).toEqual(["grid:ci-region:6"]);
    expect(sets[0]?.ex).toBe(CI_REGION_RETAIN_SECONDS);
    expect(sleeps).toEqual([]);

    now += CI_REGION_FRESH_MS + 1;
    fetchImpl.mockImplementation(async () => {
      throw new Error("upstream down");
    });
    const stale = await readRegionalIntensity(6, {
      fetchImpl: fetchImpl as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => now,
      redis,
    });
    expect(stale.state).toBe("stale");
    expect(stale.reading?.forecast).toBe(80);
    expect(sleeps).toEqual([200, 800]);
    expect(sets.every((entry) => /^grid:ci-region:(?:[1-9]|1[0-4])$/.test(entry.key))).toBe(true);
  });

  it("does not retry a 400 and does abort on the timeout", async () => {
    let rejected = 0;
    const denied = await readRegionalIntensity(3, {
      fetchImpl: async () => {
        rejected += 1;
        return new Response("no", { status: 400 });
      },
      sleep: async () => undefined,
      redis: null,
      now: () => 10,
    });
    expect(denied.state).toBe("not_yet_available");
    expect(rejected).toBe(1);

    resetRegionalIntensityForTests();
    let aborted = 0;
    const timed = await readRegionalIntensity(1, {
      fetchImpl: (_url, init) => {
        aborted += 1;
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("missing signal"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      },
      timeoutMs: 20,
      sleep: async () => undefined,
      redis: null,
      now: () => 20,
    });
    expect(timed.state).toBe("not_yet_available");
    expect(aborted).toBe(3);
  });
});

describe("resolver", () => {
  it("returns the three stored areas and does not infer one from another", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return okResponse(Number(String(url).split("/").at(-1)));
      }),
    );
    const sy1 = found(await resolvePostcode("SY1 1HQ"));
    const sy10 = found(await resolvePostcode("SY10 7AA"));
    const chester = found(await resolvePostcode("CH1 2HQ"));
    const border = found(await resolvePostcode("TD15 1BN"));
    const london = found(await resolvePostcode("SW1A 1AA"));
    expect(sy1.body.local_authority?.code).toBe("E06000051");
    expect(sy10.body.local_authority?.code).toBe("E06000051");
    expect(sy1.body.dno?.id).toBe("nged-west-midlands");
    expect(sy10.body.dno?.id).toBe("spen-manweb");
    expect(sy10.body.carbon_intensity_region).toEqual({ id: 6, name: "North Wales & Merseyside" });
    expect(sy1.body.carbon_intensity_region?.id).toBe(8);
    expect(chester.body.carbon_intensity_region?.id).toBe(6);
    expect(chester.body.carbon_intensity_region?.id).not.toBe(3);
    expect(border.body.carbon_intensity_region?.id).toBe(2);
    expect(border.body.carbon_intensity_region?.id).not.toBe(4);
    expect(london.body.carbon_intensity_region).toEqual({ id: 13, name: "London" });
    expect(urls).toEqual([
      "https://api.carbonintensity.org.uk/regional/regionid/8",
      "https://api.carbonintensity.org.uk/regional/regionid/6",
      "https://api.carbonintensity.org.uk/regional/regionid/2",
      "https://api.carbonintensity.org.uk/regional/regionid/13",
    ]);
    expect(containsPostcode(urls)).toBe(false);

    const again = await resolvePostcode("CH1 2HQ");
    expect(urls).toHaveLength(4);
    expect(again.analytics && containsPostcode(again.analytics)).toBe(false);
    for (const result of [sy1, sy10, chester, border, london, again]) {
      expect(result.analytics?.name).toBe("area");
      expect(result.analytics?.props).not.toHaveProperty("postcode");
      expect(containsPostcode(result.analytics)).toBe(false);
      expect(containsPostcode(result.body)).toBe(false);
    }
  });

  it("returns a stored contradiction unchanged", async () => {
    let called = false;
    const reader: PostcodeReader = {
      async lookup() {
        return {
          available: true,
          state: null,
          row: {
            la: { code: "E06000051", name: "Shropshire" },
            dno: { id: "custom-dno", name: "Not The DNO" },
            ci: { id: 6, name: "Not The LA" },
            terminated: false,
          },
        };
      },
    };
    const result = await resolvePostcode("SY10 7AA", {
      reader,
      intensity: async () => {
        called = true;
        return { state: null, reading: null };
      },
    });
    expect(result.body).toMatchObject({
      status: "found",
      local_authority: { code: "E06000051", name: "Shropshire" },
      dno: { id: "custom-dno", name: "Not The DNO" },
      carbon_intensity_region: { id: 6, name: "Not The LA" },
    });
    expect(called).toBe(true);
    expect(containsPostcode(result.body)).toBe(false);
    expect(containsPostcode(result.analytics)).toBe(false);

    const dropped = await resolvePostcode("SY10 7AA", {
      reader: {
        async lookup() {
          return {
            available: true,
            state: null,
            row: {
              la: { code: "E06000051", name: "Shropshire" },
              dno: null,
              ci: { id: 99, name: "Nope" },
              terminated: false,
            },
          };
        },
      },
      intensity: async () => {
        throw new Error("region 99 must not be fetched");
      },
    });
    expect(dropped.body).toMatchObject({ status: "found", carbon_intensity_region: null, intensity: null });
  });

  it("distinguishes unknown, terminated, and a missing lookup", async () => {
    const terminated = await resolvePostcode("W1A 0AA");
    expect(terminated).toMatchObject({
      http: 200,
      analytics: null,
      body: { status: "not_found", reason: "terminated" },
    });
    expect(terminated.body).not.toHaveProperty("local_authority");
    expect(containsPostcode(terminated.body)).toBe(false);

    const unknown = await resolvePostcode("ZZ99 9ZZ");
    expect(unknown.body).toMatchObject({ status: "not_found", reason: "unknown" });

    let looked = false;
    const invalid = await resolvePostcode("not a postcode", {
      reader: {
        async lookup() {
          looked = true;
          return { available: false };
        },
      },
    });
    expect(looked).toBe(false);
    expect(invalid.body).toMatchObject({ status: "not_found", reason: "unknown" });

    const down = await resolvePostcode("SW1A 1AA", {
      reader: {
        async lookup() {
          return { available: false };
        },
      },
    });
    expect(down).toEqual({ http: 503, analytics: null, body: { error: API_ERROR_SOURCE_UNAVAILABLE } });
  });

  it("builds an analytics event with no postcode parameter", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/postcode/analytics.ts"), "utf8");
    expect(source).not.toMatch(/function areaAnalyticsEvent\([^)]*postcode/);
    const event = areaAnalyticsEvent({
      localAuthority: { code: "E06000051", name: "Shropshire" },
      dno: { id: "spen-manweb", name: "North Wales, Merseyside and Cheshire" },
      carbonIntensityRegion: { id: 6, name: "North Wales & Merseyside" },
    });
    expect(event).toEqual({
      name: "area",
      props: {
        local_authority: "E06000051",
        dno: "spen-manweb",
        carbon_intensity_region: "6",
      },
    });
    expect(containsPostcode(event)).toBe(false);
  });
});

describe("blob reader", () => {
  it("hashes the outward code and keeps the last shard when a read fails", async () => {
    const path = postcodeShardPath("ons-nspl:nspl:2026-09-01T11:08:22.000Z", "CH1");
    expect(path).not.toContain("CH1");
    expect(path).not.toContain("2HQ");
    expect(path).not.toContain("CH12HQ");
    expect(path).toMatch(/^releases\/postcodes\/ons-nspl_nspl_2026-09-01T11_08_22\.000Z\/[a-f0-9]{64}\.json$/);

    const store = new MemoryPostcodeStore();
    const row: PostcodeRow = {
      la: { code: "E06000050", name: "Cheshire West and Chester" },
      dno: { id: "spen-manweb", name: "North Wales, Merseyside and Cheshire" },
      ci: { id: 6, name: "North Wales & Merseyside" },
      terminated: false,
    };
    await publishPostcodeRelease(store, "rel-1", new Map([["CH12HQ", row]]), "2026-10-20T12:00:00.000Z");
    let failShard = false;
    const flaky: PostcodeObjectStore = {
      async put(pathname, body, options) {
        await store.put(pathname, body, options);
      },
      async get(pathname) {
        if (failShard && pathname !== "releases/postcodes/latest.json") {
          throw new Error("blob down");
        }
        return store.get(pathname);
      },
    };
    const reader = blobPostcodeReader(flaky);
    expect(await reader.lookup("CH12HQ")).toEqual({ available: true, row, state: null });
    expect(await reader.lookup("SW1A1AA")).toEqual({ available: true, row: null, state: null });
    failShard = true;
    expect(await reader.lookup("CH12HQ")).toEqual({ available: true, row, state: "stale" });
    expect(await blobPostcodeReader(new MemoryPostcodeStore()).lookup("CH12HQ")).toEqual({ available: false });
    const keys = [...store.files.keys()].join("\n");
    expect(keys).not.toContain("CH1");
    expect(keys).not.toContain("2HQ");
  });
});

describe("POST /api/v1/postcode", () => {
  it("keeps the postcode out of the URL, the log, and the body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => okResponse(Number(String(url).split("/").at(-1)))),
    );
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const found = await POST(
      new Request("http://localhost/api/v1/postcode", {
        method: "POST",
        body: JSON.stringify({ postcode: "SY10 7AA" }),
      }),
    );
    expect(found.status).toBe(200);
    const body = await found.json();
    expect(body.status).toBe("found");
    expect(containsPostcode(body)).toBe(false);
    expect(body).not.toHaveProperty("analytics");
    expect(spy).toHaveBeenCalledWith("[postcode] resolve", { status: "found" });
    expect(containsPostcode(spy.mock.calls)).toBe(false);

    const queried = await POST(new Request("http://localhost/api/v1/postcode?postcode=SW1A%201AA"));
    expect(queried.status).toBe(400);
    expect(await queried.json()).toEqual({ error: "unsupported filter" });
    expect(containsPostcode(spy.mock.calls)).toBe(false);

    const scoped = await POST(
      new Request("http://localhost/api/v1/postcode?scope=NI", {
        method: "POST",
        body: JSON.stringify({ postcode: "SW1A 1AA" }),
      }),
    );
    expect(scoped.status).toBe(400);
    expect(containsPostcode(spy.mock.calls)).toBe(false);

    const extra = await POST(
      new Request("http://localhost/api/v1/postcode", {
        method: "POST",
        body: JSON.stringify({ postcode: "SW1A 1AA", export: true }),
      }),
    );
    expect(extra.status).toBe(400);
    expect(await extra.json()).toEqual({ error: "unsupported filter" });
    const route = readFileSync(resolve(process.cwd(), "src/app/api/v1/postcode/route.ts"), "utf8");
    expect(route).not.toContain("queryPipe");
    expect(route).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("postcode catalogue", () => {
  it("rejects a bad release and leaves an existing edition line in place", () => {
    expect(
      postcodeReleaseErrors([
        { dataset_id: "ons-nspl:nspl", content: { ...NSPL_RELEASE_CONTENT, geography: "UK" } },
      ]).length,
    ).toBeGreaterThan(0);
    expect(sha256Prefixed(NSPL_RELEASE_CONTENT)).toBe(
      "sha256:cae6e08d05f2428aef24d43fb9246dda587a857f270c72560dda2d9e5225aba7",
    );
    const dir = mkdtempSync(join(tmpdir(), "postcode-catalogue-"));
    try {
      const clock = new Date("2026-10-20T12:00:00.000Z");
      const first = commitPostcodeEdition(dir, NSPL_RELEASE_CONTENT, NSPL_PUBLISHED_AT, clock);
      expect(first.wroteRelease).toBe(true);
      const changed = { ...NSPL_RELEASE_CONTENT, bytes: NSPL_RELEASE_CONTENT.bytes + 1 };
      const second = commitPostcodeEdition(dir, changed, NSPL_PUBLISHED_AT, clock);
      expect(second.wroteRelease).toBe(false);
      expect(second.sourceReleaseId).toBe(first.sourceReleaseId);
      const releaseText = readFileSync(join(dir, "source_releases.ndjson"), "utf8").trim().split("\n");
      expect(releaseText).toHaveLength(1);
      expect(releaseText[0]).toContain(NSPL_RELEASE_CONTENT.bytes.toString());
      const third = commitPostcodeEdition(dir, NSPL_RELEASE_CONTENT, "2026-12-01T00:00:00.000Z", clock);
      expect(third.wroteRelease).toBe(true);
      expect(readFileSync(join(dir, "source_releases.ndjson"), "utf8").trim().split("\n")).toHaveLength(2);
      expect(readFileSync(join(dir, "ingestion_runs.ndjson"), "utf8").trim().split("\n")).toHaveLength(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails offline when the NSPL cache is missing and does not mention a download", () => {
    const dir = mkdtempSync(join(tmpdir(), "postcode-offline-"));
    const script = resolve(process.cwd(), "scripts/catalogue/postcodes.ts");
    const source = readFileSync(script, "utf8");
    expect(source).not.toMatch(/console\.(log|info|error|warn)\([^)]*BLOB_READ_WRITE_TOKEN/);
    expect(source).toContain("offline NSPL cache is missing");
    const result = spawnSync(
      resolve(process.cwd(), "node_modules/.bin/tsx"),
      ["--tsconfig", resolve(process.cwd(), "tsconfig.json"), script, "--offline"],
      {
        cwd: dir,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).not.toBe(0);
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    expect(output).toContain("offline NSPL cache is missing");
    expect(output).not.toContain("arcgis.com");
    expect(output).not.toContain("https://");
  });
});
