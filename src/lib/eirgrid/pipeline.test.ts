import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RetryableError } from "workflow";
import { setBlobReadbackSleepForTests } from "@/lib/blob-readback";
import {
  NI_CATALOGUE_RELEASES_PATH,
  NI_LATEST_PATH,
  NI_PREVIOUS_PATH,
  MemoryNiStore,
  niImmutablePut,
  niRawPath,
  setNiStoreForTests,
  type NiObjectStore,
} from "@/lib/eirgrid/blob";
import type { EirgridFetchBundle } from "@/lib/eirgrid/fetch";
import { parseMarketPricingDocument } from "@/lib/eirgrid/parse";
import { publishNiBundle, validateNiBundle, stripMarketSterling } from "@/lib/eirgrid/pipeline";
import { revalidateNiPaths } from "@/lib/eirgrid/revalidate";

vi.mock("@/lib/eirgrid/revalidate", () => ({
  revalidateNiPaths: vi.fn(),
}));

const MARKET = String.raw`{"rows":[{\"date\":\"15-Oct-2026 00:30:00\",\"NET_IMBALANCE_VOLUME\":38.738,\"IMBALANCE_SETTLEMENT_PRICE\":266.7,\"IMBALANCE_SETTLEMENT_PRICE_GBP\":237.82}]}`;

const CHART = JSON.stringify({
  LastUpdated: "15-Oct-2026 01:00:00",
  Rows: [{ EffectiveTime: "15-Oct-2026 00:00:00", FieldName: "SYSTEM_DEMAND", Region: "NI", Value: 636 }],
});

const FUEL = JSON.stringify({
  LastUpdated: "15-Oct-2026 03:00:00",
  Rows: [
    { EffectiveTime: "15-Oct-2026 00:00:00", FieldName: "FUEL_GAS", Region: "NI", Value: 10 },
    { EffectiveTime: "15-Oct-2026 00:00:00", FieldName: "FUEL_RENEW", Region: "NI", Value: 20 },
    { EffectiveTime: "15-Oct-2026 00:00:00", FieldName: "FUEL_NET_IMPORT", Region: "NI", Value: 5 },
  ],
});

function bundle(): EirgridFetchBundle {
  return {
    retrieved_at: "2026-10-15T04:00:00.000Z",
    charts: { NI: CHART, ROI: CHART, ALL: CHART },
    interconnection: { NI: "{}", ROI: "{}", ALL: "{}" },
    fuel: { NI: FUEL, ROI: "{}", ALL: "{}" },
    snsp: "{}",
    market: MARKET,
  };
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

afterEach(() => {
  setNiStoreForTests(null);
  setBlobReadbackSleepForTests(null);
  vi.mocked(revalidateNiPaths).mockReset();
});

describe("Northern Ireland publish", () => {
  it("drops the sterling column before the raw extract is stored", () => {
    const stored = stripMarketSterling(MARKET);
    expect(stored).not.toContain("IMBALANCE_SETTLEMENT_PRICE_GBP");
    expect(stored).not.toContain("237.82");
    const price = parseMarketPricingDocument(stored).series.find(
      (series) => series.metric_id === "elec.all_island.price.imbalance",
    );
    expect(price?.points[0]?.value).toBe(266.7);
  });

  it("keeps the previous pointer when revalidation fails", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const body = JSON.stringify(bundle());
    const hash = sha256Text(body);
    await store.put(niRawPath(hash.slice("sha256:".length)), body, niImmutablePut("application/json"));
    await store.put(
      NI_LATEST_PATH,
      JSON.stringify({ release_id: "old", generated_at: "2026-10-14T15:00:00.000Z" }),
      niImmutablePut("application/json"),
    );
    vi.mocked(revalidateNiPaths).mockImplementation(() => {
      throw new Error("revalidate failed");
    });

    await expect(publishNiBundle(hash, new Date("2026-10-15T15:15:00.000Z"))).rejects.toThrow(/revalidate failed/);
    expect(JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}")).toMatchObject({ release_id: "old" });
    expect(await store.get(NI_PREVIOUS_PATH)).toBeNull();
  });

  it("stamps each catalogue area from its own feed and then moves the pointer", async () => {
    const store = new MemoryNiStore();
    setNiStoreForTests(store);
    const body = JSON.stringify(bundle());
    const hash = sha256Text(body);
    await store.put(niRawPath(hash.slice("sha256:".length)), body, niImmutablePut("application/json"));
    await store.put(
      NI_LATEST_PATH,
      JSON.stringify({ release_id: "old", generated_at: "2026-10-14T15:00:00.000Z" }),
      niImmutablePut("application/json"),
    );

    const published = await publishNiBundle(hash, new Date("2026-10-15T15:15:00.000Z"));
    const latest = JSON.parse((await store.get(NI_LATEST_PATH))?.body ?? "{}") as { release_id: string };
    expect(latest.release_id).toBe(published.releaseId);
    expect(JSON.parse((await store.get(NI_PREVIOUS_PATH))?.body ?? "{}")).toMatchObject({ release_id: "old" });

    const lines = ((await store.get(NI_CATALOGUE_RELEASES_PATH))?.body ?? "")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { dataset_id: string; published_at: string | null; source_release_id: string });
    const demand = lines.find((line) => line.dataset_id === "eirgrid-group:demandactual");
    const fuel = lines.find((line) => line.dataset_id === "eirgrid-group:fuelmix");
    const market = lines.find((line) => line.dataset_id === "eirgrid-group:marketPricing");
    expect(demand?.published_at).toBe("2026-10-15T00:00:00.000Z");
    expect(demand?.source_release_id).toBe("eirgrid-group:demandactual:2026-10-15T00:00:00.000Z");
    expect(fuel?.published_at).toBe("2026-10-15T02:00:00.000Z");
    expect(fuel?.source_release_id).toBe("eirgrid-group:fuelmix:2026-10-15T02:00:00.000Z");
    expect(market?.published_at).toBeNull();
    expect(market?.source_release_id.startsWith("eirgrid-group:marketPricing:sha256:")).toBe(true);
  });

  it("publishes from the step bundle when blob reads are not-found", async () => {
    const inner = new MemoryNiStore();
    setNiStoreForTests(inner);
    const carried = bundle();
    const published = await publishNiBundle("sha256:unused", new Date("2026-10-15T15:15:00.000Z"), carried);
    expect(published.ok).toBe(true);
    expect(published.releaseId.length).toBeGreaterThan(0);
    const reads = hidingRaw(inner, Number.POSITIVE_INFINITY);
    setNiStoreForTests(reads.store);
    await expect(validateNiBundle("sha256:unused", carried)).resolves.toMatchObject({ ok: true });
    expect(reads.rawMisses).toBe(0);
  });

  it("reads the extract after the first two blob gets are not-found", async () => {
    setBlobReadbackSleepForTests(async () => undefined);
    const inner = new MemoryNiStore();
    const body = JSON.stringify(bundle());
    const hash = sha256Text(body);
    await inner.put(niRawPath(hash.slice("sha256:".length)), body, niImmutablePut("application/json"));
    const reads = hidingRaw(inner, 2);
    setNiStoreForTests(reads.store);

    const validated = await validateNiBundle(hash);
    expect(validated.ok).toBe(true);
    expect(reads.rawMisses).toBe(2);

    const exhausted = hidingRaw(inner, 5);
    setNiStoreForTests(exhausted.store);
    const error = await validateNiBundle(hash).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(RetryableError);
    expect((error as Error).message).toBe("EirGrid extract is missing");
  });
});

function hidingRaw(inner: MemoryNiStore, misses: number): { store: NiObjectStore; rawMisses: number } {
  const state = { rawMisses: 0 };
  const store: NiObjectStore = {
    put: (pathname, body, options) => inner.put(pathname, body, options),
    get: async (pathname) => {
      if (pathname.includes("/raw/") && state.rawMisses < misses) {
        state.rawMisses += 1;
        return null;
      }
      return inner.get(pathname);
    },
    del: (pathnames) => inner.del(pathnames),
  };
  return {
    store,
    get rawMisses() {
      return state.rawMisses;
    },
  };
}
