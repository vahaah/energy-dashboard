import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";
import {
  NI_CATALOGUE_RUNS_PATH,
  NI_LATEST_PATH,
  NI_PREVIOUS_PATH,
  MemoryNiStore,
  niReleasePath,
  setNiStoreForTests,
} from "@/lib/eirgrid/blob";
import { EIRGRID_FETCH_TIMEOUT_MS, EIRGRID_REQUEST_RETRIES, EIRGRID_TINYBIRD_OPS } from "@/lib/eirgrid/budget";
import { EIRGRID_PART_IDS, eirgridRequestBackoffMs } from "@/lib/eirgrid/fetch";
import { metricIdsForEirgridPart } from "@/lib/eirgrid/build";
import { fetchNiBundle, publishNiBundle } from "@/lib/eirgrid/pipeline";
import { niReleaseSchema, type NiRelease } from "@/lib/eirgrid/release";
import { revalidateNiPaths } from "@/lib/eirgrid/revalidate";

vi.mock("@/lib/eirgrid/revalidate", () => ({
  revalidateNiPaths: vi.fn(),
}));

const MARKET = String.raw`{"rows":[{\"date\":\"20-Oct-2026 15:00:00\",\"NET_IMBALANCE_VOLUME\":38.738,\"IMBALANCE_SETTLEMENT_PRICE\":266.7,\"IMBALANCE_SETTLEMENT_PRICE_GBP\":237.82}]}`;

function chart(demand: number): string {
  return JSON.stringify({
    LastUpdated: "20-Oct-2026 15:00:00",
    Rows: [{ EffectiveTime: "20-Oct-2026 15:00:00", FieldName: "SYSTEM_DEMAND", Region: "NI", Value: demand }],
  });
}

function partOf(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname.includes("market-pricing")) {
    return "market";
  }
  if (parsed.searchParams.get("area") === "SnspAll") {
    return "snsp";
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
    expect(calls.get("chart:NI")).toBe(2);
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
    const part = partOf(String(input));
    return textResponse(part === "chart:NI" ? chart(demand) : part === "market" ? MARKET : "{}");
  };
  const fetched = await fetchNiBundle(now, { fetchImpl, gapMs: 0, sleep: async () => undefined });
  const published = await publishNiBundle(fetched.hash, now);
  expect(await store.get(niReleasePath(published.releaseId))).not.toBeNull();
  return published;
}
