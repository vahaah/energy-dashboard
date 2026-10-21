import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FatalError, RetryableError } from "workflow";
import { GET as overviewRoute } from "@/app/api/v1/gas/overview/route";
import { GET as seriesRoute } from "@/app/api/v1/gas/series/route";
import { checkCatalogue } from "@/lib/catalogue/check";
import { loadDataHealth } from "@/lib/data-health";
import {
  GAS_CATALOGUE_RELEASES_PATH,
  GAS_CATALOGUE_STAMP_PATH,
  GAS_LATEST_PATH,
  GAS_POINTER_KEY,
  GAS_PREVIOUS_PATH,
  MemoryGasStore,
  gasBundlePointerPath,
  gasQuarantinePath,
  gasReleasePath,
  gasSeriesPath,
  gasStore,
  immutablePut,
  mutablePut,
  setGasStoreForTests,
} from "@/lib/gas/blob";
import {
  GAS_COMPLETED_DAY_RUNS_PER_DAY,
  GAS_MAX_RETRIES,
  GAS_TINYBIRD_OPS,
  GAS_WORKFLOW_EVENTS_PER_DAY,
  GAS_WORKFLOW_EVENTS_PER_RUN,
  fetchGasBundle,
  gasRetryAfter,
  gasStepError,
  publishGasBundle,
  readPointer,
  validateGasBundle,
  GasBodyMissingError,
  GasHttpError,
  pruneQuarantine,
} from "@/lib/gas/pipeline";
import { countedDayTotals, gasOverviewResponse, gasReadingStale, gasSeriesResponse } from "@/lib/gas/query";
import { NATIONAL_GAS_CATALOGUE_SHA256 } from "@/lib/ingest/national-gas/catalogue";
import { gasFixtureDir } from "@/lib/ingest/national-gas/check";
import {
  GAS_CATALOGUE_URL,
  GAS_COMPLETED_DAY_PUBLICATION_IDS,
  GAS_DOWNLOAD_URL,
  GAS_INTRADAY_PUBLICATION_IDS,
  gasBundleCsvUrl,
  gasBundleWindow,
} from "@/lib/ingest/national-gas/bundles";
import { partsReconcile } from "@/lib/ingest/national-gas/total";
import type { GasRelease } from "@/lib/ingest/national-gas/release";
import { getRedis, resetRedisClient, setRedisForTests, type RedisCommands } from "@/lib/redis-cache";
import { SHIPPED_PAGE_ROUTES, SITE_NAV_CATALOG, visibleNavHrefs } from "@/lib/site-nav";
import { gasSlot, takeWorkflowSlot } from "@/lib/workflow-slot";
import { publishCompletedGasDayStep, takeGasSlotStep } from "@/workflows/steps/gas";

const revalidated: string[] = [];

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));

class MemoryRedis implements RedisCommands {
  readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= Date.now()) {
      return null;
    }
    return hit.value as T;
  }

  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<"OK" | null> {
    const existing = this.store.get(key);
    if (opts?.nx && existing && existing.expiresAt > Date.now()) {
      return null;
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (opts?.ex ?? 60) * 1000,
    });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }

  async incr(key: string): Promise<number> {
    const next = Number((await this.get<number | string>(key)) ?? 0) + 1;
    await this.set(key, next, { ex: 86_400 });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const hit = this.store.get(key);
    if (!hit || hit.expiresAt <= Date.now()) {
      return 0;
    }
    hit.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

const COMPLETED_NOW = new Date("2026-10-14T16:00:00.000Z");
const INTRADAY_NOW = new Date("2026-10-15T06:05:00.000Z");
/** 04:05 London, still gas day 2026-10-14, which is the day the rate fixtures cover. */
const INTRADAY_PUBLISH = new Date("2026-10-15T03:05:00.000Z");
const DEMAND_PARENT = 165.302;
const SUPPLY_PARENT = 165.45767;
const DEMAND_CHILDREN = [66.99963, 43.31715, 22.44785, 2.18238, 30.2398] as const;
const COUNTED_KWH = [1_828_508_719, 736_157_413, 484_171_605, 245_364_389] as const;

let store: MemoryGasStore;

function bundleCsv(ids: readonly string[]): string {
  const header = "Applicable At,Applicable For,Data Item,Value,Generated Time,Quality Indicator";
  const rows: string[] = [];
  for (const id of ids) {
    const text = readFileSync(join(gasFixtureDir(), `${id}.csv`), "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (line.length === 0 || line.startsWith("#") || line.startsWith("Applicable At,")) {
        continue;
      }
      rows.push(line);
    }
  }
  return `${header}\n${rows.join("\n")}\n`;
}

function mockFetch(handler: (url: string) => Response | Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return handler(url);
    }),
  );
}

async function seedStamp(now: Date, sha256: string | null = NATIONAL_GAS_CATALOGUE_SHA256): Promise<void> {
  await store.put(
    GAS_CATALOGUE_STAMP_PATH,
    `${JSON.stringify({ sha256, fetched_at: now.toISOString() })}\n`,
    mutablePut("application/json"),
  );
}

async function publishFixture(
  bundle: "intraday" | "completed-day",
  now: Date,
  catalogueDir?: string,
): Promise<{ hash: string; releaseId: string }> {
  const ids = bundle === "intraday" ? GAS_INTRADAY_PUBLICATION_IDS : GAS_COMPLETED_DAY_PUBLICATION_IDS;
  await seedStamp(now);
  mockFetch((url) => {
    if (url.startsWith(GAS_DOWNLOAD_URL)) {
      return new Response(bundleCsv(ids), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  const fetched = await fetchGasBundle(bundle, now, 1);
  expect(Object.keys(fetched).sort()).toEqual(["bytes", "hash", "ok", "releaseId", "rows"]);
  expect(fetched.ok).toBe(true);
  expect(typeof fetched.rows).toBe("number");
  const validated = await validateGasBundle(fetched.hash, bundle, now);
  const published = await publishGasBundle(fetched.hash, bundle, now, catalogueDir);
  expect(published.releaseId).toBe(validated.releaseId);
  expect(published.releaseId.length).toBeGreaterThan(0);
  return { hash: fetched.hash, releaseId: published.releaseId };
}

async function readRelease(releaseId: string): Promise<GasRelease> {
  const stored = await gasStore().get(gasReleasePath(releaseId), true);
  if (!stored) {
    throw new Error("missing release");
  }
  return JSON.parse(stored.body) as GasRelease;
}

describe("gas publish", () => {
  beforeEach(() => {
    store = new MemoryGasStore();
    setGasStoreForTests(store);
    setRedisForTests(new MemoryRedis());
    revalidated.length = 0;
  });

  afterEach(() => {
    setGasStoreForTests(null);
    resetRedisClient();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the intraday window on London 05:00 stamps and leaves SAP out", () => {
    const window = gasBundleWindow("intraday", INTRADAY_NOW);
    expect(window).toEqual({ from: "2026-10-15T05:00:00", to: "2026-10-16T05:00:00" });
    expect(window.from).toHaveLength(19);
    const completed = gasBundleWindow("completed-day", COMPLETED_NOW);
    expect(completed).toEqual({ from: "2026-10-11T05:00:00", to: "2026-10-14T05:00:00" });
    const url = new URL(gasBundleCsvUrl(GAS_INTRADAY_PUBLICATION_IDS, window.from, window.to));
    expect(url.searchParams.get("ids")?.split(",")).toEqual([...GAS_INTRADAY_PUBLICATION_IDS]);
    expect(url.searchParams.get("ids")).not.toContain("PUBOB603");
    expect(GAS_COMPLETED_DAY_PUBLICATION_IDS).not.toContain("PUBOB603");
    expect(gasSlot(new Date("2026-10-15T06:07:00.000Z"))).toBe("2026-10-15T06:05:00.000Z");
  });

  it("reconciles the completed-day fixture without summing rates or children", async () => {
    const { releaseId } = await publishFixture("completed-day", COMPLETED_NOW);
    const release = await readRelease(releaseId);
    expect(release.gas_day.label).toBe("2026-10-13");
    const counted = countedDayTotals(release);
    const byId = new Map(counted.map((row) => [row.publication_id, row.value]));
    expect(byId.get("PUBOB637")).toBe(DEMAND_PARENT);
    expect(byId.get("PUBOBJ635")).toBe(SUPPLY_PARENT);
    const mscm = counted.filter((row) => row.unit === "mscm").map((row) => row.publication_id).sort();
    expect(mscm).toEqual(["PUBOB637", "PUBOBJ635"]);
    const kwh = counted.filter((row) => row.unit === "kWh").map((row) => row.value).sort((left, right) => left - right);
    expect(kwh).toEqual([...COUNTED_KWH].sort((left, right) => left - right));
    expect(COUNTED_KWH.reduce((total, value) => total + value, 0)).toBe(3_294_202_126);
    const childIds = ["PUBOBJ1015", "PUBOBJ1016", "PUBOBJ1017", "PUBOBJ1018", "PUBOBJ1020", "PUBOBJ630"];
    for (const id of childIds) {
      expect(byId.has(id)).toBe(false);
    }
    const children = ["PUBOBJ1015", "PUBOBJ1016", "PUBOBJ1017", "PUBOBJ1018", "PUBOBJ1020"].map((id) => {
      const component = release.components.find((row) => row.publication_id === id);
      expect(component?.counts).toBe(false);
      return component?.value ?? Number.NaN;
    });
    expect(children).toEqual([...DEMAND_CHILDREN]);
    const childScaled = children.reduce((total, value) => total + Math.round(value * 100_000), 0);
    expect(childScaled).toBe(16_518_681);
    expect(Math.round(DEMAND_PARENT * 1_000)).toBe(165_302);
    expect(partsReconcile(DEMAND_PARENT, children)).toBe(false);
    const withdrawal = release.components.find((row) => row.publication_id === "PUBOBJ630");
    expect(withdrawal?.counts).toBe(false);
    expect(withdrawal?.value).toBe(0);
    expect(release.components.some((row) => row.quantity_kind === "rate")).toBe(false);
    const downloads = vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).startsWith(GAS_DOWNLOAD_URL));
    expect(downloads).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.some((call) => String(call[0]).startsWith(GAS_CATALOGUE_URL))).toBe(false);
  });

  it("does not sum intraday rates", async () => {
    const { releaseId } = await publishFixture("intraday", INTRADAY_PUBLISH);
    const release = await readRelease(releaseId);
    expect(release.gas_day.label).toBe("2026-10-14");
    expect(countedDayTotals(release)).toEqual([]);
    const national = release.components.filter((row) => row.publication_id === "PUBOB2042");
    expect(national.length).toBeGreaterThan(1);
    expect(national.every((row) => row.counts === false && row.quantity_kind === "rate")).toBe(true);
    const summed = national.reduce((total, row) => total + (row.value ?? 0), 0);
    expect(national.some((row) => row.value === summed)).toBe(false);
    const byInstant = new Map<string, Record<string, number>>();
    for (const row of release.components) {
      if (row.publication_id !== "PUBOB2042" && row.publication_id !== "PUBOB2043" && row.publication_id !== "PUBOB2044") {
        continue;
      }
      const slot = byInstant.get(row.applicable_at) ?? {};
      slot[row.publication_id] = row.value ?? Number.NaN;
      byInstant.set(row.applicable_at, slot);
    }
    for (const slot of byInstant.values()) {
      if (slot.PUBOB2042 == null || slot.PUBOB2043 == null || slot.PUBOB2044 == null) {
        continue;
      }
      expect(partsReconcile(slot.PUBOB2042, [slot.PUBOB2043, slot.PUBOB2044])).toBe(true);
    }
  });

  it("creates no second release when the same CSV is published again", async () => {
    const first = await publishFixture("completed-day", COMPLETED_NOW);
    revalidated.length = 0;
    const again = await publishGasBundle(first.hash, "completed-day", new Date(COMPLETED_NOW.getTime() + 60_000));
    expect(again.releaseId).toBe(first.releaseId);
    const files = [...store.files.keys()].filter((path) => /^releases\/gas\/[a-f0-9]{64}\.json$/.test(path));
    expect(files).toEqual([gasReleasePath(first.releaseId)]);
    const lines = store.files.get(GAS_CATALOGUE_RELEASES_PATH)?.body.trim().split("\n") ?? [];
    expect(lines).toHaveLength(1);
    expect(revalidated).toEqual([]);
    const pointer = await readPointer(GAS_LATEST_PATH);
    expect(pointer).toEqual({ release_id: first.releaseId, generated_at: COMPLETED_NOW.toISOString() });
  });

  it("quarantines a malformed CSV and keeps the previous pointer", async () => {
    const first = await publishFixture("completed-day", COMPLETED_NOW);
    mockFetch(() => new Response("<html>not csv", { status: 200 }));
    const bad = await fetchGasBundle("completed-day", COMPLETED_NOW, 1);
    await expect(validateGasBundle(bad.hash, "completed-day", COMPLETED_NOW)).rejects.toBeInstanceOf(FatalError);
    await expect(publishGasBundle(bad.hash, "completed-day", COMPLETED_NOW)).rejects.toBeInstanceOf(FatalError);
    expect(await readPointer(GAS_LATEST_PATH)).toEqual({
      release_id: first.releaseId,
      generated_at: COMPLETED_NOW.toISOString(),
    });
    const quarantined = [...store.files.keys()].filter((path) => path.startsWith("quarantine/"));
    expect(quarantined).toEqual([gasQuarantinePath("2026-10-14", bad.hash.slice("sha256:".length))]);
  });

  it("retries an empty National Gas body and does not store it", async () => {
    await seedStamp(INTRADAY_NOW);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockFetch(() => new Response("", { status: 200 }));
    const retry = await fetchGasBundle("intraday", INTRADAY_NOW, 1).then(
      () => null,
      (error: unknown) => error,
    );
    expect(retry).toBeInstanceOf(RetryableError);
    expect((retry as Error).message).toBe("National Gas raw body is missing");
    await expect(fetchGasBundle("intraday", INTRADAY_NOW, GAS_MAX_RETRIES + 1)).rejects.toBeInstanceOf(FatalError);
    expect(gasStepError(new GasBodyMissingError(), 1)).toBeInstanceOf(RetryableError);
    expect(gasStepError(new GasBodyMissingError(), GAS_MAX_RETRIES + 1)).toBeInstanceOf(FatalError);
    expect(warn).toHaveBeenCalledWith("[gas] National Gas raw body is missing", { status: 200 });
    expect([...store.files.keys()].some((path) => path.includes("/raw/"))).toBe(false);
    warn.mockRestore();
  });

  it("retries a missing stored raw body and then reads it", async () => {
    const published = await publishFixture("intraday", INTRADAY_PUBLISH);
    const rawKey = [...store.files.keys()].find((path) => path.includes("/raw/"));
    expect(rawKey).toBeTruthy();
    let misses = 0;
    const inner = store;
    setGasStoreForTests({
      put: (pathname, body, options) => inner.put(pathname, body, options),
      get: async (pathname) => {
        if (pathname === rawKey && misses < 2) {
          misses += 1;
          return null;
        }
        return inner.get(pathname);
      },
      list: (prefix) => inner.list(prefix),
      del: (pathnames) => inner.del(pathnames),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const validated = await validateGasBundle(published.hash, "intraday", INTRADAY_PUBLISH);
    expect(validated.ok).toBe(true);
    expect(validated.releaseId).toBe(published.releaseId);
    expect(misses).toBe(2);
    expect(warn).toHaveBeenCalledWith("[gas] National Gas raw body is missing", {
      bundle: "intraday",
      attempt: 1,
    });
    expect(warn).toHaveBeenCalledWith("[gas] National Gas raw body is missing", {
      bundle: "intraday",
      attempt: 2,
    });
    warn.mockRestore();
    setGasStoreForTests(store);
  });

  it("retries 429 with jitter and then keeps the previous release", async () => {
    mockFetch(() => new Response("slow", { status: 429 }));
    await seedStamp(INTRADAY_NOW);
    const retry = await fetchGasBundle("intraday", INTRADAY_NOW, 1).then(
      () => null,
      (error: unknown) => error,
    );
    expect(retry).toBeInstanceOf(RetryableError);
    const delta = (retry as RetryableError).retryAfter.getTime() - Date.now();
    expect(delta).toBeGreaterThanOrEqual(30_000);
    expect(delta).toBeLessThan(40_000);
    await expect(fetchGasBundle("intraday", INTRADAY_NOW, GAS_MAX_RETRIES + 1)).rejects.toBeInstanceOf(FatalError);
    expect(store.files.has(GAS_LATEST_PATH)).toBe(false);

    mockFetch(() => new Response("no", { status: 400 }));
    await expect(fetchGasBundle("intraday", INTRADAY_NOW, 1)).rejects.toBeInstanceOf(FatalError);
    expect(gasStepError(new GasHttpError(500), 1)).toBeInstanceOf(RetryableError);
    expect(gasStepError(new GasHttpError(500), 3)).toBeInstanceOf(FatalError);
    const backedOff = gasRetryAfter(2, INTRADAY_NOW.getTime()).getTime() - INTRADAY_NOW.getTime();
    expect(backedOff).toBeGreaterThanOrEqual(120_000);
    expect(backedOff).toBeLessThan(130_000);
  });

  it("fetches the catalogue hash once per UTC day and stores no body", async () => {
    let catalogueGets = 0;
    mockFetch((url) => {
      if (url === GAS_CATALOGUE_URL) {
        catalogueGets += 1;
        return new Response("not-the-catalogue-body", { status: 200 });
      }
      return new Response(bundleCsv(GAS_INTRADAY_PUBLICATION_IDS), { status: 200 });
    });
    await expect(fetchGasBundle("intraday", INTRADAY_NOW, 1)).rejects.toBeInstanceOf(FatalError);
    expect(catalogueGets).toBe(1);
    const stamp = JSON.parse(store.files.get(GAS_CATALOGUE_STAMP_PATH)?.body ?? "{}") as {
      sha256: string;
      fetched_at: string;
    };
    expect(stamp.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(stamp.sha256).not.toBe(NATIONAL_GAS_CATALOGUE_SHA256);
    expect(JSON.stringify(stamp)).not.toContain("not-the-catalogue-body");
    await expect(fetchGasBundle("intraday", INTRADAY_NOW, 1)).rejects.toBeInstanceOf(FatalError);
    expect(catalogueGets).toBe(1);
    expect(store.files.has(GAS_LATEST_PATH)).toBe(false);
  });

  it("skips the catalogue GET after an exhausted failure stores an empty hash", async () => {
    let catalogueGets = 0;
    mockFetch(() => {
      catalogueGets += 1;
      throw new TypeError("network down");
    });
    await expect(fetchGasBundle("intraday", INTRADAY_NOW, GAS_MAX_RETRIES + 1)).rejects.toBeInstanceOf(FatalError);
    expect(catalogueGets).toBe(1);
    const stamp = JSON.parse(store.files.get(GAS_CATALOGUE_STAMP_PATH)?.body ?? "{}") as { sha256: string | null };
    expect(stamp.sha256).toBeNull();
    mockFetch((url) => {
      if (url === GAS_CATALOGUE_URL) {
        catalogueGets += 1;
      }
      return new Response(bundleCsv(GAS_INTRADAY_PUBLICATION_IDS), { status: 200 });
    });
    const fetched = await fetchGasBundle("intraday", INTRADAY_NOW, 1);
    expect(fetched.ok).toBe(true);
    expect(catalogueGets).toBe(1);
  });

  it("drops quarantine older than 90 days", async () => {
    await store.put(gasQuarantinePath("2026-01-01", "aa"), "old", immutablePut("text/csv"));
    await store.put(gasQuarantinePath("2026-10-01", "bb"), "kept", immutablePut("text/csv"));
    expect(await pruneQuarantine(new Date("2026-10-15T00:00:00.000Z"))).toBe(1);
    expect(store.files.has(gasQuarantinePath("2026-01-01", "aa"))).toBe(false);
    expect(store.files.has(gasQuarantinePath("2026-10-01", "bb"))).toBe(true);
  });

  it("serves overview and series from Blob and rejects an unknown metric", async () => {
    const { releaseId } = await publishFixture("completed-day", COMPLETED_NOW);
    const overview = await gasOverviewResponse("2026-10-13");
    expect(overview.status).toBe(200);
    if (overview.status !== 200) {
      return;
    }
    const counted = overview.body.counted as Array<{ publication_id: string; value: number }>;
    expect(counted.find((row) => row.publication_id === "PUBOB637")?.value).toBe(DEMAND_PARENT);
    expect(overview.body.gas_day).toMatchObject({ label: "2026-10-13" });
    const series = await gasSeriesResponse(
      "gas.gb_nts.demand.actual_volume",
      "2026-10-13",
      "2026-10-15",
    );
    expect(series.status).toBe(200);
    if (series.status !== 200) {
      return;
    }
    const points = series.body.points as Array<{ applicable_at: string; gas_day: string; value: number }>;
    expect(points.some((point) => point.value === DEMAND_PARENT && point.gas_day === "2026-10-13")).toBe(true);
    expect(points.every((point) => point.applicable_at.endsWith("Z") && point.gas_day === "2026-10-13")).toBe(true);
    expect((await gasSeriesResponse("not-a-metric", "2026-10-13", "2026-10-15")).status).toBe(400);
    expect((await gasSeriesResponse("elec.gb.demand.itsdo", "2026-10-13", "2026-10-15")).status).toBe(400);
    expect((await gasOverviewResponse("2026-02-31")).status).toBe(400);
    expect((await gasOverviewResponse("2020-01-01")).status).toBe(404);
    const http = await seriesRoute(
      new Request(
        "http://localhost/api/v1/gas/series?metric=gas.gb_nts.demand.actual_volume&from=2026-10-14T14:00:00.000Z&to=2026-10-14T15:00:00.000Z",
      ),
    );
    expect(http.status).toBe(200);
    const body = (await http.json()) as { points: Array<{ applicable_at: string; gas_day: string }> };
    expect(body.points[0]?.applicable_at).toBe("2026-10-14T14:20:00.000Z");
    expect(body.points[0]?.gas_day).toBe("2026-10-13");
    const unknown = await seriesRoute(
      new Request("http://localhost/api/v1/gas/series?metric=nope&from=2026-10-13&to=2026-10-15"),
    );
    expect(unknown.status).toBe(400);
    const page = await overviewRoute(new Request("http://localhost/api/v1/gas/overview?gas_day=2026-10-13"));
    expect(page.status).toBe(200);
    expect(((await page.json()) as { release_id: string }).release_id).toBe(releaseId);
    expect(await getRedis()?.get(GAS_POINTER_KEY)).toEqual({
      release_id: releaseId,
      generated_at: COMPLETED_NOW.toISOString(),
    });
  });

  it("keeps both bundles when the older completed day publishes second", async () => {
    const intraday = await publishFixture("intraday", INTRADAY_PUBLISH);
    await publishFixture("completed-day", COMPLETED_NOW);
    expect(await readPointer(GAS_LATEST_PATH)).toEqual({
      release_id: intraday.releaseId,
      generated_at: INTRADAY_PUBLISH.toISOString(),
    });
    const health = await loadDataHealth(INTRADAY_NOW);
    expect(health.find((reading) => reading.metric_id === "gas.gb_nts.demand.actual_volume")).toMatchObject({
      value: DEMAND_PARENT,
      stale: false,
      state: null,
    });
    const national = health.find((reading) => reading.metric_id === "gas.gb_nts.entry.physical.national");
    expect(national?.value).not.toBeNull();
    expect(national?.state).toBe("stale");
  });

  it("replays catalogue and series without moving a newer pointer", async () => {
    const intraday = await publishFixture("intraday", INTRADAY_PUBLISH);
    const completed = await publishFixture("completed-day", COMPLETED_NOW);
    store.files.delete(gasSeriesPath("gas.gb_nts.demand.actual_volume"));
    store.files.delete(gasBundlePointerPath("completed-day"));
    store.files.delete(GAS_CATALOGUE_RELEASES_PATH);
    revalidated.length = 0;
    const again = await publishGasBundle(completed.hash, "completed-day", COMPLETED_NOW);
    expect(again.releaseId).toBe(completed.releaseId);
    expect(await readPointer(GAS_LATEST_PATH)).toEqual({
      release_id: intraday.releaseId,
      generated_at: INTRADAY_PUBLISH.toISOString(),
    });
    expect(store.files.has(gasSeriesPath("gas.gb_nts.demand.actual_volume"))).toBe(true);
    const lines = store.files.get(GAS_CATALOGUE_RELEASES_PATH)?.body.trim().split("\n") ?? [];
    expect(lines).toHaveLength(1);
    expect(revalidated).toEqual(["/gas", "/api/v1/gas/overview", "/api/v1/gas/series"]);
  });

  it("reads the Blob pointer when the Redis cache rejects", async () => {
    const { releaseId } = await publishFixture("completed-day", COMPLETED_NOW);
    const redis: RedisCommands = {
      async get<T>(): Promise<T | null> {
        throw new Error("redis unavailable");
      },
      async set(): Promise<"OK"> {
        return "OK";
      },
      async del(): Promise<number> {
        return 0;
      },
      async incr(): Promise<number> {
        return 1;
      },
      async expire(): Promise<number> {
        return 1;
      },
    };
    setRedisForTests(redis);
    const overview = await gasOverviewResponse(null);
    expect(overview.status).toBe(200);
    if (overview.status === 200) {
      expect(overview.body.release_id).toBe(releaseId);
    }
  });

  it("marks intraday stale after 3 hours and leaves a completed gas day current", async () => {
    const published = new Date("2026-10-15T03:00:00.000Z");
    const exactly = new Date(published.getTime() + 3 * 60 * 60 * 1000);
    expect(gasReadingStale("PT1H", published.toISOString(), exactly)).toBe(false);
    expect(gasReadingStale("PT1H", published.toISOString(), new Date(exactly.getTime() + 1))).toBe(true);
    expect(gasReadingStale("P1D", "2025-01-01T00:00:00.000Z", new Date("2026-10-15T00:00:00.000Z"))).toBe(false);
    expect(gasReadingStale("PT1H", null, exactly)).toBe(false);

    await publishFixture("completed-day", COMPLETED_NOW);
    const later = await loadDataHealth(new Date("2027-08-01T00:00:00.000Z"));
    const demand = later.find((reading) => reading.metric_id === "gas.gb_nts.demand.actual_volume");
    expect(demand).toMatchObject({ value: DEMAND_PARENT, stale: false, state: null });
    expect(demand?.label).not.toContain("GB gas SAP");

    store.files.clear();
    revalidated.length = 0;
    await publishFixture("intraday", INTRADAY_PUBLISH);
    const fresh = await loadDataHealth(INTRADAY_NOW);
    const national = fresh.find((reading) => reading.metric_id === "gas.gb_nts.entry.physical.national");
    expect(national?.value).not.toBeNull();
    expect(national?.stale).toBe(true);
    expect(national?.state).toBe("stale");
  });

  it("records a publish-check release without a second line on replay", async () => {
    const root = mkdtempSync(join(tmpdir(), "gas-repo-"));
    const dir = join(root, "data", "catalogue");
    cpSync(join(process.cwd(), "data/catalogue"), dir, { recursive: true });
    mkdirSync(join(root, "public/tiles/layers/dno"), { recursive: true });
    cpSync(
      join(process.cwd(), "public/tiles/layers/dno/20240503.geojson"),
      join(root, "public/tiles/layers/dno/20240503.geojson"),
    );
    const first = await publishFixture("completed-day", COMPLETED_NOW, dir);
    const checked = checkCatalogue(dir);
    expect(checked.ok, checked.errors.join("\n")).toBe(true);
    await publishGasBundle(first.hash, "completed-day", COMPLETED_NOW, dir);
    const replay = checkCatalogue(dir);
    expect(replay.ok, replay.errors.join("\n")).toBe(true);
    const blobLines = store.files.get(GAS_CATALOGUE_RELEASES_PATH)?.body.trim().split("\n") ?? [];
    expect(blobLines).toHaveLength(1);
  });

  it("holds the gas slot and lets a failed completed day leave prices a status", async () => {
    const redis = new MemoryRedis();
    setRedisForTests(redis);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 500 }));
    const slot = gasSlot(INTRADAY_NOW);
    await takeGasSlotStep(slot, "owner-a");
    await takeGasSlotStep(slot, "owner-a");
    await expect(takeWorkflowSlot("gas", slot, "owner-b")).rejects.toBeInstanceOf(FatalError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    mockFetch(() => new Response("<html>", { status: 200 }));
    await seedStamp(COMPLETED_NOW);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const status = await publishCompletedGasDayStep(COMPLETED_NOW.toISOString());
    expect(status).toEqual({ ok: false, rows: 0, bytes: 0, hash: "", releaseId: "" });
    expect(store.files.has(GAS_LATEST_PATH)).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it("revalidates gas paths only and adds no Tinybird ops", () => {
    expect(GAS_WORKFLOW_EVENTS_PER_RUN).toBe(9);
    expect(GAS_WORKFLOW_EVENTS_PER_DAY).toBe(216);
    expect(GAS_COMPLETED_DAY_RUNS_PER_DAY).toBe(4);
    expect(GAS_TINYBIRD_OPS).toBe(0);
    expect(revalidated.includes("/")).toBe(false);
    const files = [
      "src/workflows/gas-intraday.ts",
      "src/workflows/steps/gas.ts",
      "src/lib/gas/pipeline.ts",
      "src/lib/gas/query.ts",
      "src/lib/gas/revalidate.ts",
      "src/app/api/cron-gas/route.ts",
      "src/app/api/v1/gas/overview/route.ts",
      "src/app/api/v1/gas/series/route.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toContain("queryPipe");
      expect(source, file).not.toContain("fetchPipeRows");
      expect(source, file).not.toContain("ingestRows");
      expect(source, file).not.toContain("api.tinybird");
    }
    const revalidate = readFileSync(join(process.cwd(), "src/lib/gas/revalidate.ts"), "utf8");
    expect(revalidate).toContain('revalidatePath("/gas")');
    expect(revalidate).toContain('revalidatePath("/api/v1/gas/overview")');
    expect(revalidate).toContain('revalidatePath("/api/v1/gas/series")');
    expect(revalidate).not.toContain('revalidatePath("/")');
    const prices = readFileSync(join(process.cwd(), "src/workflows/prices.ts"), "utf8");
    const publishAt = prices.indexOf("await publishStep(nowIso, false)");
    const gasAt = prices.indexOf("await publishCompletedGasDayStep(nowIso)");
    const fatalAt = prices.indexOf("required price source failed");
    expect(prices).toContain("fetchSapStep");
    expect(gasAt).toBeGreaterThan(publishAt);
    expect(fatalAt).toBeGreaterThan(gasAt);
    const cron = readFileSync(join(process.cwd(), "src/app/api/cron-gas/route.ts"), "utf8");
    expect(cron).not.toContain("find-gas-data");
    expect(cron).not.toContain("data.nationalgas.com");
    expect(cron).toContain("start(gasIntraday");
    const gasPagePath = join(process.cwd(), "src/app/gas/page.tsx");
    expect(existsSync(gasPagePath)).toBe(true);
    const gasPage = readFileSync(gasPagePath, "utf8");
    expect(gasPage).toContain('export const dynamic = "force-static"');
    expect(gasPage).toContain("export const revalidate = 900");
    expect(gasPage).not.toContain("queryPipe");
    expect(SHIPPED_PAGE_ROUTES).toContain("/gas");
    expect(visibleNavHrefs()).toContain("/gas");
    const labels = SITE_NAV_CATALOG.flatMap((entry) =>
      entry.kind === "link" ? [entry.label] : [entry.label, ...entry.items.map((item) => item.label)],
    );
    expect(labels).toContain("Gas");
    const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(vercel.crons.find((cronJob) => cronJob.path === "/api/cron-gas")?.schedule).toBe("5 * * * *");
    const steps = readFileSync(join(process.cwd(), "src/workflows/steps/gas.ts"), "utf8");
    expect(steps.match(/maxRetries = GAS_MAX_RETRIES/g)).toHaveLength(5);
    expect(store.files.has(GAS_PREVIOUS_PATH)).toBe(false);
  });
});
