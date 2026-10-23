import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";
import {
  NI_CATALOGUE_RELEASES_PATH,
  NI_CATALOGUE_RUNS_PATH,
  NI_LATEST_PATH,
  NI_PREVIOUS_PATH,
  MemoryNiStore,
  niReleasePath,
  setNiStoreForTests,
} from "@/lib/eirgrid/blob";
import { EIRGRID_FETCH_TIMEOUT_MS, EIRGRID_REQUEST_RETRIES, EIRGRID_TINYBIRD_OPS } from "@/lib/eirgrid/budget";
import { EIRGRID_PART_IDS, eirgridRequestBackoffMs } from "@/lib/eirgrid/fetch";
import { CHART_AREAS } from "@/lib/eirgrid/spec";
import { metricIdsForEirgridPart } from "@/lib/eirgrid/build";
import { fetchNiBundle, publishNiBundle } from "@/lib/eirgrid/pipeline";
import { niReleaseSchema, type NiRelease } from "@/lib/eirgrid/release";
import { revalidateNiPaths } from "@/lib/eirgrid/revalidate";

vi.mock("@/lib/eirgrid/revalidate", () => ({
  revalidateNiPaths: vi.fn(),
}));

const MARKET = String.raw`{"rows":[{\"date\":\"20-Oct-2026 15:00:00\",\"NET_IMBALANCE_VOLUME\":38.738,\"IMBALANCE_SETTLEMENT_PRICE\":266.7,\"IMBALANCE_SETTLEMENT_PRICE_GBP\":237.82}]}`;

const CHART_FILL = 7;

const CHART_FIELD: Record<string, string> = {
  demandactual: "SYSTEM_DEMAND",
  generationactual: "GEN_EXP",
  windactual: "WIND_ACTUAL",
  windforecast: "WIND_FCAST",
  solaractual: "SOLAR_ACTUAL",
  solarforecast: "SOLAR_FCAST",
  co2intensity: "CO2_INTENSITY",
};

function chart(demand: number): string {
  return chartAt("20-Oct-2026 15:00:00", demand);
}

function chartAt(lastUpdated: string, demand: number): string {
  return feed(lastUpdated, [{ EffectiveTime: lastUpdated, FieldName: "SYSTEM_DEMAND", Region: "NI", Value: demand }]);
}

function feed(
  lastUpdated: string,
  rows: { EffectiveTime: string; FieldName: string; Region: string; Value: number }[],
): string {
  return JSON.stringify({ LastUpdated: lastUpdated, Rows: rows });
}

type CatalogueLine = {
  dataset_id: string;
  published_at: string | null;
  source_release_id: string;
  content: { release_id: string };
};

async function catalogueLines(store: MemoryNiStore): Promise<CatalogueLine[]> {
  return ((await store.get(NI_CATALOGUE_RELEASES_PATH))?.body ?? "")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CatalogueLine);
}

function partOf(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname.includes("market-pricing")) {
    return "market";
  }
  const areas = parsed.searchParams.get("areas");
  if (parsed.searchParams.get("area") === "SnspAll" || areas === "SnspAll") {
    return "snsp";
  }
  if (areas?.includes("imbalancePrice") || areas?.includes("imbalanceVolume")) {
    return "market";
  }
  if (parsed.searchParams.get("area") === "fuelmix") {
    return `fuel:${parsed.searchParams.get("region")}`;
  }
  const region = parsed.searchParams.get("region");
  if (parsed.searchParams.get("areas") === "interconnection") {
    return `interconnection:${region}`;
  }
  return `chart:${region}`;
}

function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

function valueOf(release: NiRelease, metricId: string): number | null {
  const series = release.series.find((row) => row.metric_id === metricId);
  return series?.points.find((point) => point.value != null)?.value ?? null;
}

function newestValue(release: NiRelease, metricId: string): number | null {
  const series = release.series.find((row) => row.metric_id === metricId);
  return [...(series?.points ?? [])].reverse().find((point) => point.value != null)?.value ?? null;
}

async function publishedRelease(store: MemoryNiStore, releaseId: string): Promise<NiRelease> {
  const file = await store.get(niReleasePath(releaseId));
  return niReleaseSchema.parse(JSON.parse(file?.body ?? "{}"));
}

afterEach(() => {
  setNiStoreForTests(null);
  vi.mocked(revalidateNiPaths).mockReset();
  vi.restoreAllMocks();
});

describe("EirGrid fetch", () => {
  it("carries Ireland series for a failed ROI chart and Northern Ireland fuel for a failed fuel part", () => {
    const roi = metricIdsForEirgridPart("chart:ROI");
    const fuel = metricIdsForEirgridPart("fuel:NI");
    expect(roi).toContain("elec.ie.demand.system");
    expect(roi).not.toContain("elec.ni.demand.system");
    expect(fuel).toContain("elec.ni.fuel.gas");
    expect(fuel).not.toContain("elec.ie.fuel.gas");
  });

  it("publishes when one request times out once and then succeeds", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const calls = new Map<string, number>();
    const slept: number[] = [];
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      const part = partOf(url);
      const seen = (calls.get(part) ?? 0) + 1;
      calls.set(part, seen);
      if (part.startsWith("chart:")) {
        const areas = new URL(url).searchParams.get("areas") ?? "";
        expect(areas.includes(",")).toBe(false);
        expect(CHART_AREAS).toContain(areas);
      }
      if (part === "chart:NI" && seen === 1) {
        throw timeoutError();
      }
      return textResponse(part === "chart:NI" ? chart(636) : part === "market" ? MARKET : "{}");
    };

    const fetched = await fetchNiBundle(new Date("2026-10-20T15:15:00.000Z"), {
      fetchImpl,
      gapMs: 0,
      random: () => 0,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    const published = await publishNiBundle(fetched.hash, new Date("2026-10-20T15:15:00.000Z"));
    const release = await publishedRelease(store, published.releaseId);
    const latest = JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}") as { release_id: string };

    expect(EIRGRID_FETCH_TIMEOUT_MS).toBe(25_000);
    expect(EIRGRID_REQUEST_RETRIES).toBe(2);
    expect(EIRGRID_PART_IDS).toHaveLength(11);
    expect(timeout).toHaveBeenCalledWith(25_000);
    expect(calls.get("chart:NI")).toBe(CHART_AREAS.length + 1);
    expect(slept).toEqual([eirgridRequestBackoffMs(1, () => 0)]);
    expect(latest.release_id).toBe(published.releaseId);
    expect(valueOf(release, "elec.ni.demand.system")).toBe(636);
    expect(valueOf(release, "elec.all_island.price.imbalance")).toBe(266.7);
    expect(EIRGRID_TINYBIRD_OPS).toBe(0);
  });

  it("publishes the parts that succeeded and keeps the previous series for a part that exhausts its retries", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const first = await publishGood(store, 636, new Date("2026-10-20T15:15:00.000Z"));
    const calls = new Map<string, number>();
    const slept: number[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const part = partOf(String(input));
      const seen = (calls.get(part) ?? 0) + 1;
      calls.set(part, seen);
      if (part === "market") {
        return textResponse("unavailable", 500);
      }
      return textResponse(part === "chart:NI" ? chart(700) : "{}");
    };

    const fetched = await fetchNiBundle(new Date("2026-10-20T16:15:00.000Z"), {
      fetchImpl,
      gapMs: 0,
      random: () => 0,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    const published = await publishNiBundle(fetched.hash, new Date("2026-10-20T16:15:00.000Z"));
    const release = await publishedRelease(store, published.releaseId);
    const latest = JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}") as { release_id: string };
    const previous = JSON.parse((await store.get(NI_PREVIOUS_PATH))?.body ?? "{}") as { release_id: string };
    const runs = ((await store.get(NI_CATALOGUE_RUNS_PATH))?.body ?? "")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { status: string; started_at: string });

    expect(calls.get("market")).toBe(EIRGRID_REQUEST_RETRIES + 1);
    expect(slept).toEqual([1_000, 2_000]);
    expect(latest.release_id).toBe(published.releaseId);
    expect(previous.release_id).toBe(first.releaseId);
    expect(valueOf(release, "elec.ni.demand.system")).toBe(700);
    expect(valueOf(release, "elec.all_island.price.imbalance")).toBe(266.7);
    expect(runs.some((run) => run.started_at === "2026-10-20T16:15:00.000Z" && run.status === "partial")).toBe(true);
    expect(runs.some((run) => run.started_at === "2026-10-20T15:15:00.000Z" && run.status === "succeeded")).toBe(true);
  });

  it("does not retry a 4xx and still keeps the previous series for that part", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    await publishGood(store, 636, new Date("2026-10-20T15:15:00.000Z"));
    let marketCalls = 0;
    const fetchImpl = async (input: RequestInfo | URL) => {
      const part = partOf(String(input));
      if (part === "market") {
        marketCalls += 1;
        return textResponse("no", 400);
      }
      return textResponse(part === "chart:NI" ? chart(710) : "{}");
    };

    const fetched = await fetchNiBundle(new Date("2026-10-20T16:15:00.000Z"), {
      fetchImpl,
      gapMs: 0,
      sleep: async () => undefined,
    });
    const published = await publishNiBundle(fetched.hash, new Date("2026-10-20T16:15:00.000Z"));
    const release = await publishedRelease(store, published.releaseId);

    expect(marketCalls).toBe(1);
    expect(valueOf(release, "elec.ni.demand.system")).toBe(710);
    expect(valueOf(release, "elec.all_island.price.imbalance")).toBe(266.7);
  });

  it("keeps a failed area's own catalogue time when another part publishes", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const fuel = feed("20-Oct-2026 13:00:00", [
      { EffectiveTime: "20-Oct-2026 13:00:00", FieldName: "FUEL_GAS", Region: "NI", Value: 10 },
      { EffectiveTime: "20-Oct-2026 13:00:00", FieldName: "FUEL_RENEW", Region: "NI", Value: 20 },
      { EffectiveTime: "20-Oct-2026 13:00:00", FieldName: "FUEL_NET_IMPORT", Region: "NI", Value: 5 },
    ]);
    const snsp = feed("20-Oct-2026 14:00:00", [
      { EffectiveTime: "20-Oct-2026 14:00:00", FieldName: "SNSP_ALL", Region: "ALL", Value: 40 },
    ]);
    const firstFetch = async (input: RequestInfo | URL) => {
      const part = partOf(String(input));
      if (part === "chart:NI") {
        return textResponse(chartAt("20-Oct-2026 12:00:00", 636));
      }
      if (part === "fuel:NI") {
        return textResponse(fuel);
      }
      if (part === "snsp") {
        return textResponse(snsp);
      }
      if (part === "market") {
        return textResponse(MARKET);
      }
      return textResponse("{}");
    };
    const firstFetched = await fetchNiBundle(new Date("2026-10-20T11:15:00.000Z"), {
      fetchImpl: firstFetch,
      gapMs: 0,
      sleep: async () => undefined,
    });
    const first = await publishNiBundle(firstFetched.hash, new Date("2026-10-20T11:15:00.000Z"));
    const firstRelease = await publishedRelease(store, first.releaseId);

    const secondFetch = async (input: RequestInfo | URL) => {
      const part = partOf(String(input));
      if (part.startsWith("fuel:") || part === "snsp") {
        return textResponse("down", 500);
      }
      if (part === "chart:NI") {
        return textResponse(chartAt("20-Oct-2026 16:00:00", 700));
      }
      if (part === "market") {
        return textResponse(MARKET);
      }
      return textResponse("{}");
    };
    const secondFetched = await fetchNiBundle(new Date("2026-10-20T15:15:00.000Z"), {
      fetchImpl: secondFetch,
      gapMs: 0,
      sleep: async () => undefined,
    });
    const published = await publishNiBundle(secondFetched.hash, new Date("2026-10-20T15:15:00.000Z"));
    const lines = await catalogueLines(store);
    const second = lines.filter((line) => line.content.release_id === published.releaseId);
    const demand = second.find((line) => line.dataset_id === "eirgrid-group:demandactual");
    const fuelmix = second.find((line) => line.dataset_id === "eirgrid-group:fuelmix");
    const snspLine = second.find((line) => line.dataset_id === "eirgrid-group:SnspAll");

    expect(firstRelease.published_at).toBe("2026-10-20T11:00:00.000Z");
    expect(valueOf(await publishedRelease(store, published.releaseId), "elec.ni.fuel.gas")).toBe(10);
    expect(demand?.published_at).toBe("2026-10-20T15:00:00.000Z");
    expect(demand?.source_release_id).toBe("eirgrid-group:demandactual:2026-10-20T15:00:00.000Z");
    expect(fuelmix?.published_at).toBe("2026-10-20T12:00:00.000Z");
    expect(fuelmix?.source_release_id).toBe("eirgrid-group:fuelmix:2026-10-20T12:00:00.000Z");
    expect(snspLine?.published_at).toBe("2026-10-20T13:00:00.000Z");
    expect(snspLine?.source_release_id).toBe("eirgrid-group:SnspAll:2026-10-20T13:00:00.000Z");
  });

  it("leaves the previous pointer when every request is exhausted", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const first = await publishGood(store, 636, new Date("2026-10-20T15:15:00.000Z"));
    const fetchImpl = async () => textResponse("down", 503);

    await expect(
      fetchNiBundle(new Date("2026-10-20T16:15:00.000Z"), {
        fetchImpl,
        gapMs: 0,
        sleep: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(FatalError);
    const latest = JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}") as { release_id: string };
    expect(latest.release_id).toBe(first.releaseId);
  });

  it("requests SNSP and SEMO on the chart API through the London day, and keeps a zero-row SNSP series", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const snsp = feed("21-Oct-2026 03:00:00", [
      { EffectiveTime: "21-Oct-2026 00:00:00", FieldName: "SNSP_ALL", Region: "ALL", Value: 71.173 },
      { EffectiveTime: "21-Oct-2026 03:00:00", FieldName: "SNSP_ALL", Region: "ALL", Value: 70.65 },
    ]);
    const market = JSON.stringify({
      Rows: [
        { EffectiveTime: "21-Oct-2026 01:00:00", FieldName: "IMBALANCE_SETTLEMENT_PRICE", Region: "ALL", Value: 28.13 },
        { EffectiveTime: "21-Oct-2026 01:30:00", FieldName: "IMBALANCE_SETTLEMENT_PRICE", Region: "ALL", Value: 36.63 },
        { EffectiveTime: "21-Oct-2026 02:00:00", FieldName: "IMBALANCE_SETTLEMENT_PRICE", Region: "ALL", Value: null },
        { EffectiveTime: "21-Oct-2026 01:00:00", FieldName: "NET_IMBALANCE_VOLUME", Region: "ALL", Value: -28.621 },
        { EffectiveTime: "21-Oct-2026 01:30:00", FieldName: "NET_IMBALANCE_VOLUME", Region: "ALL", Value: -27.332 },
      ],
    });
    let snspUrl = "";
    let marketUrl = "";
    const first = await fetchNiBundle(new Date("2026-10-21T02:15:00.000Z"), {
      fetchImpl: async (input) => {
        const url = String(input);
        const part = partOf(url);
        if (part === "snsp") {
          snspUrl = url;
          return textResponse(snsp);
        }
        if (part === "market") {
          marketUrl = url;
          return textResponse(market);
        }
        if (part === "chart:NI") {
          return textResponse(chart(636));
        }
        return textResponse("{}");
      },
      gapMs: 0,
      sleep: async () => undefined,
    });
    const published = await publishNiBundle(first.hash, new Date("2026-10-21T02:15:00.000Z"));
    const release = await publishedRelease(store, published.releaseId);
    const snspParams = new URL(snspUrl).searchParams;
    const marketParams = new URL(marketUrl).searchParams;

    expect(new URL(snspUrl).pathname).toBe("/api/chart/");
    expect(snspParams.get("region")).toBe("ALL");
    expect(snspParams.get("areas")).toBe("SnspAll");
    expect(snspParams.get("dateFrom")).toBe("2026-10-20");
    expect(snspParams.get("dateTo")).toBe("2026-10-21");
    expect(snspUrl).not.toContain("DashboardService.svc");
    expect(marketParams.get("region")).toBe("ALL");
    expect(marketParams.get("areas")).toBe("imbalancePrice,imbalanceVolume");
    expect(marketParams.get("dateFrom")).toBe("2026-10-20");
    expect(marketParams.get("dateTo")).toBe("2026-10-21");
    const snspPoints = release.series.find((series) => series.metric_id === "elec.all_island.snsp.share")?.points ?? [];
    expect(snspPoints.map((point) => point.time)).toEqual(["2026-10-20T23:00:00.000Z", "2026-10-21T02:00:00.000Z"]);
    expect(snspPoints[1]?.value).toBe(70.65);
    const pricePoints = release.series.find((series) => series.metric_id === "elec.all_island.price.imbalance")?.points ?? [];
    expect(pricePoints.at(-1)).toEqual({ time: "2026-10-21T00:30:00.000Z", value: 36.63 });
    expect(pricePoints.some((point) => point.value == null)).toBe(false);

    warn.mockClear();
    const failed = await fetchNiBundle(new Date("2026-10-21T03:15:00.000Z"), {
      fetchImpl: async (input) => {
        const part = partOf(String(input));
        if (part === "snsp") {
          return textResponse("down", 503);
        }
        if (part === "chart:NI") {
          return textResponse(chart(640));
        }
        if (part === "market") {
          return textResponse(market);
        }
        return textResponse("{}");
      },
      gapMs: 0,
      sleep: async () => undefined,
    });
    await publishNiBundle(failed.hash, new Date("2026-10-21T03:15:00.000Z"));
    expect(warn).toHaveBeenCalledWith("[eirgrid] partial fetch", {
      failed: expect.arrayContaining([{ part: "snsp", reason: "HTTP 503" }]),
    });
    expect(newestValue(await publishedRelease(store, (JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}") as { release_id: string }).release_id), "elec.all_island.snsp.share")).toBe(70.65);

    warn.mockClear();
    const empty = await fetchNiBundle(new Date("2026-10-21T04:15:00.000Z"), {
      fetchImpl: async (input) => {
        const part = partOf(String(input));
        if (part === "snsp") {
          return textResponse(JSON.stringify({ Rows: [] }));
        }
        if (part === "chart:NI") {
          return textResponse(chart(641));
        }
        if (part === "market") {
          return textResponse(market);
        }
        return textResponse("{}");
      },
      gapMs: 0,
      sleep: async () => undefined,
    });
    await publishNiBundle(empty.hash, new Date("2026-10-21T04:15:00.000Z"));
    const latestId = (JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}") as { release_id: string }).release_id;
    expect(warn).toHaveBeenCalledWith("[eirgrid] zero rows", { part: "snsp" });
    expect(warn).toHaveBeenCalledWith("[eirgrid] partial fetch", {
      failed: expect.arrayContaining([{ part: "snsp", reason: "zero rows" }]),
    });
    expect(newestValue(await publishedRelease(store, latestId), "elec.all_island.snsp.share")).toBe(70.65);
    expect(valueOf(await publishedRelease(store, latestId), "elec.ni.demand.system")).toBe(641);
  });

  it("carries the previous NI demand when that area's response drops the field", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const first = await publishGood(store, 636, new Date("2026-10-20T15:15:00.000Z"));
    const windOnly = feed("20-Oct-2026 16:00:00", [
      { EffectiveTime: "20-Oct-2026 16:00:00", FieldName: "WIND_ACTUAL", Region: "NI", Value: 50 },
    ]);
    const generation = feed("20-Oct-2026 16:00:00", [
      { EffectiveTime: "20-Oct-2026 16:00:00", FieldName: "GEN_EXP", Region: "NI", Value: 800 },
    ]);
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const part = partOf(url.toString());
      const areas = url.searchParams.get("areas");
      const region = url.searchParams.get("region");
      if (areas === "demandactual" && region === "NI") {
        return textResponse(windOnly);
      }
      if (areas === "generationactual" && region === "NI") {
        return textResponse(generation);
      }
      if (part === "market") {
        return textResponse(MARKET);
      }
      return textResponse("{}");
    };

    const fetched = await fetchNiBundle(new Date("2026-10-20T16:15:00.000Z"), {
      fetchImpl,
      gapMs: 0,
      sleep: async () => undefined,
    });
    const published = await publishNiBundle(fetched.hash, new Date("2026-10-20T16:15:00.000Z"));
    const release = await publishedRelease(store, published.releaseId);

    expect(published.releaseId).not.toBe(first.releaseId);
    expect(fetched.bundle?.failed_parts ?? []).not.toContain("chart:NI");
    expect(fetched.bundle?.carry_metric_ids ?? []).toContain("elec.ni.demand.system");
    expect(fetched.bundle?.carry_metric_ids ?? []).not.toContain("elec.ni.generation.system");
    expect(valueOf(release, "elec.ni.demand.system")).toBe(636);
    expect(valueOf(release, "elec.ni.generation.system")).toBe(800);
    expect(valueOf(release, "elec.ni.generation.wind")).toBe(CHART_FILL);
    const runs = ((await store.get(NI_CATALOGUE_RUNS_PATH))?.body ?? "")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { status: string; started_at: string });
    expect(runs.some((run) => run.started_at === "2026-10-20T16:15:00.000Z" && run.status === "partial")).toBe(true);
  });

  it("retries an empty NI demand and generation chart and publishes the later rows", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    await publishGood(store, 636, new Date("2026-10-20T15:15:00.000Z"));
    const calls = { demand: 0, generation: 0 };
    const demand = feed("20-Oct-2026 16:15:00", [
      { EffectiveTime: "20-Oct-2026 16:15:00", FieldName: "SYSTEM_DEMAND", Region: "NI", Value: 1009 },
    ]);
    const generation = feed("20-Oct-2026 16:15:00", [
      { EffectiveTime: "20-Oct-2026 16:15:00", FieldName: "GEN_EXP", Region: "NI", Value: 1110 },
    ]);
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const areas = url.searchParams.get("areas");
      const region = url.searchParams.get("region");
      if (areas === "demandactual" && region === "NI") {
        calls.demand += 1;
        return textResponse(calls.demand === 1 ? JSON.stringify({ Rows: [] }) : demand);
      }
      if (areas === "generationactual" && region === "NI") {
        calls.generation += 1;
        return textResponse(calls.generation < 3 ? JSON.stringify({ Rows: [] }) : generation);
      }
      const part = partOf(url.toString());
      if (part === "market") {
        return textResponse(MARKET);
      }
      const field = areas ? CHART_FIELD[areas] : undefined;
      if (field && region) {
        return textResponse(
          feed("20-Oct-2026 16:15:00", [
            { EffectiveTime: "20-Oct-2026 16:15:00", FieldName: field, Region: region, Value: CHART_FILL },
          ]),
        );
      }
      return textResponse("{}");
    };

    const fetched = await fetchNiBundle(new Date("2026-10-20T16:15:00.000Z"), {
      fetchImpl,
      gapMs: 0,
      random: () => 0,
      sleep: async () => undefined,
    });
    const published = await publishNiBundle(fetched.hash, new Date("2026-10-20T16:15:00.000Z"));
    const release = await publishedRelease(store, published.releaseId);

    expect(calls.demand).toBe(2);
    expect(calls.generation).toBe(3);
    expect(fetched.bundle?.carry_metric_ids ?? []).not.toContain("elec.ni.demand.system");
    expect(fetched.bundle?.carry_metric_ids ?? []).not.toContain("elec.ni.generation.system");
    expect(valueOf(release, "elec.ni.demand.system")).toBe(1009);
    expect(valueOf(release, "elec.ni.generation.system")).toBe(1110);
  });

  it("retries timeouts on an empty-body refetch before keeping the previous demand", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    await publishGood(store, 636, new Date("2026-10-20T15:15:00.000Z"));
    const calls = { demand: 0 };
    const slept: number[] = [];
    const demand = feed("20-Oct-2026 16:15:00", [
      { EffectiveTime: "20-Oct-2026 16:15:00", FieldName: "SYSTEM_DEMAND", Region: "NI", Value: 1009 },
    ]);
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const areas = url.searchParams.get("areas");
      const region = url.searchParams.get("region");
      if (areas === "demandactual" && region === "NI") {
        calls.demand += 1;
        if (calls.demand === 1) {
          return textResponse(JSON.stringify({ Rows: [] }));
        }
        if (calls.demand < 4) {
          throw timeoutError();
        }
        return textResponse(demand);
      }
      const part = partOf(url.toString());
      if (part === "market") {
        return textResponse(MARKET);
      }
      const field = areas ? CHART_FIELD[areas] : undefined;
      if (field && region) {
        return textResponse(
          feed("20-Oct-2026 16:15:00", [
            { EffectiveTime: "20-Oct-2026 16:15:00", FieldName: field, Region: region, Value: CHART_FILL },
          ]),
        );
      }
      return textResponse("{}");
    };

    const fetched = await fetchNiBundle(new Date("2026-10-20T16:15:00.000Z"), {
      fetchImpl,
      gapMs: 0,
      random: () => 0,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    const published = await publishNiBundle(fetched.hash, new Date("2026-10-20T16:15:00.000Z"));
    const release = await publishedRelease(store, published.releaseId);

    expect(calls.demand).toBe(4);
    expect(slept).toEqual([
      eirgridRequestBackoffMs(1, () => 0),
      eirgridRequestBackoffMs(1, () => 0),
      eirgridRequestBackoffMs(2, () => 0),
    ]);
    expect(fetched.bundle?.carry_metric_ids ?? []).not.toContain("elec.ni.demand.system");
    expect(valueOf(release, "elec.ni.demand.system")).toBe(1009);
  });

  it("leaves the previous pointer when every chart area is empty and the other parts fail", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const first = await publishGood(store, 636, new Date("2026-10-20T15:15:00.000Z"));
    const fetchImpl = async (input: RequestInfo | URL) => {
      const part = partOf(String(input));
      if (part.startsWith("chart:")) {
        return textResponse(JSON.stringify({ Rows: [] }));
      }
      return textResponse("down", 503);
    };

    await expect(
      fetchNiBundle(new Date("2026-10-20T16:15:00.000Z"), {
        fetchImpl,
        gapMs: 0,
        sleep: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(FatalError);
    const latest = JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}") as { release_id: string };
    expect(latest.release_id).toBe(first.releaseId);
  });

  it("prefers London for the cron entry and does not move the hourly schedule", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/cron-northern-ireland/route.ts"), "utf8");
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
      functions: Record<string, { regions?: string[] }>;
    };
    const cron = vercel.crons.find((entry) => entry.path === "/api/cron-northern-ireland");
    expect(cron?.schedule).toBe("15 * * * *");
    expect(route).toContain('preferredRegion = "lhr1"');
    expect(route).not.toContain("region:");
    expect(route).not.toContain('preferredRegion = "dub1"');
    expect(vercel.functions["src/app/api/cron-northern-ireland/route.ts"]?.regions).toEqual(["lhr1"]);
    expect(JSON.stringify(vercel)).not.toContain("dub1");
  });
});

async function publishGood(store: MemoryNiStore, demand: number, now: Date): Promise<{ releaseId: string }> {
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const part = partOf(url.toString());
    if (part.startsWith("chart:")) {
      const area = url.searchParams.get("areas") ?? "";
      const region = url.searchParams.get("region") ?? "NI";
      const field = CHART_FIELD[area] ?? "SYSTEM_DEMAND";
      const value = area === "demandactual" && region === "NI" ? demand : CHART_FILL;
      return textResponse(
        feed("20-Oct-2026 15:00:00", [
          { EffectiveTime: "20-Oct-2026 15:00:00", FieldName: field, Region: region, Value: value },
        ]),
      );
    }
    return textResponse(part === "market" ? MARKET : "{}");
  };
  const fetched = await fetchNiBundle(now, { fetchImpl, gapMs: 0, sleep: async () => undefined });
  const published = await publishNiBundle(fetched.hash, now);
  expect(await store.get(niReleasePath(published.releaseId))).not.toBeNull();
  return published;
}
