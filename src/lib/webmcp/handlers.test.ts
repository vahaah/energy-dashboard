import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AssetIndexRow } from "@/lib/assets/types";
import {
  GEONAMES_ATTRIBUTION,
  NATIONAL_GAS_ATTRIBUTION,
  OGL_V3_ATTRIBUTION,
  elexonBmrsAttribution,
} from "@/lib/attribution";
import type { DashboardPayload } from "@/lib/dashboard-payload-model";
import { CLIENT_QUERY_MAX_AGE_MS } from "@/lib/client-query";
import { emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";
import { CURRENT_PRICE_CAP } from "@/lib/price-cap";
import type { ProjectSearchRow } from "@/lib/search/project-index";
import { SHIPPED_PAGE_ROUTES } from "@/lib/site-nav";
import type { EnergySnapshot, Generation5min } from "@/lib/types";
import { WEBMCP_ORIGIN_TRIAL_TOKEN } from "@/lib/webmcp/origin-trial";
import { embeddedWebMcpJson, parseEmbeddedWebMcp } from "@/lib/webmcp/embed";
import { createWebMcpHandlers, type WebMcpDeps } from "@/lib/webmcp/handlers";
import { sourcesForPath } from "@/lib/webmcp/pages";
import { liveReadingFromPayload } from "@/lib/webmcp/reading";
import { modelContextFor } from "@/lib/webmcp/support";
import { registerGridTools } from "@/lib/webmcp/register";
import { LIVE_DASHBOARD_PATH, LOOK_AHEAD_PATH, assertNoHistoricalDate } from "@/lib/webmcp/urls";

const eurocell: ProjectSearchRow = {
  id: "epj_3415e2e58a0ec470",
  name: "Eurocell Nickel, High View Road - Solar Pv System",
  technology: "Solar PV",
  stage: "In planning",
  place: "England, East Midlands",
  mw: 0.6,
};

const sizewell: AssetIndexRow = {
  id: "ast_0000000000000001",
  name: "Sizewell B",
  operator: "EDF",
  technology: "nuclear",
  status: "operational",
  mw: 1200,
  region: "East of England",
  location: "Suffolk",
  country: "England",
  source: "DUKES",
  sources: ["DUKES"],
  latitude: 52.21,
  longitude: 1.62,
  aka: "",
};

function snapshot(): EnergySnapshot {
  return {
    timestamp: "2026-10-10 11:00:00",
    carbon_intensity: 148,
    carbon_forecast: 148,
    carbon_index: "moderate",
    demand_mw: 32_400,
    price_gbp_mwh: 67,
    price_mid_gbp_mwh: 45.2,
    gen_gas_pct: 20,
    gen_coal_pct: 0,
    gen_nuclear_pct: 15,
    gen_wind_pct: 50,
    gen_solar_pct: 5,
    gen_hydro_pct: 5,
    gen_biomass_pct: 5,
    gen_imports_pct: 0,
    gen_other_pct: 0,
    gen_gas_mw: 4000,
    gen_coal_mw: 0,
    gen_nuclear_mw: 3000,
    gen_wind_mw: 16_000,
    gen_solar_mw: 1000,
    gen_hydro_mw: 1000,
    gen_biomass_mw: 1000,
    gen_other_mw: 0,
  };
}

function generation(fuel: string, mw: number): Generation5min {
  return { timestamp: "2026-10-10 11:00:00", fuel_type: fuel, generation_mw: mw, source: "fuelinst" };
}

function payload(): DashboardPayload {
  const rows = [generation("wind", 16_000), generation("gas", 4000), generation("nuclear", 3000)];
  return {
    period: "day",
    chartRange: "24h",
    dateResolution: {
      status: "latest",
      date: "2026-10-10",
      today: "2026-10-10",
      coverageStart: "2025-03-18",
    },
    facts: {
      empty: false,
      emptyState: null,
      coverageStart: "2025-03-18",
      requestedDate: "2026-10-10",
      isHistorical: false,
      isStale: false,
      stamp: "test",
      headerStamp: "test",
      carbon: {
        value: 148,
        index: "moderate",
        unit: "gCO₂/kWh",
        periodStartUtc: "2026-10-10T10:00:00.000Z",
        periodEndUtc: "2026-10-10T10:30:00.000Z",
        source: "Carbon Intensity API",
        definition: "test",
      },
      demand: {
        value: 32_400,
        unit: "MW",
        periodStartUtc: "2026-10-10T10:00:00.000Z",
        periodEndUtc: "2026-10-10T10:30:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      price: {
        value: 45.2,
        unit: "£/MWh",
        periodStartUtc: "2026-10-10T10:00:00.000Z",
        periodEndUtc: "2026-10-10T10:30:00.000Z",
        source: "Elexon BMRS",
        definition: "Market Index",
      },
      systemPrice: {
        value: 67,
        unit: "£/MWh",
        periodStartUtc: "2026-10-10T10:00:00.000Z",
        periodEndUtc: "2026-10-10T10:30:00.000Z",
        source: "Elexon BMRS",
        definition: "System price",
      },
      generationMw: {
        value: 23_000,
        unit: "MW",
        periodStartUtc: "2026-10-10T10:00:00.000Z",
        periodEndUtc: "2026-10-10T10:30:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      netImportsMw: {
        value: 0,
        unit: "MW",
        periodStartUtc: "2026-10-10T10:00:00.000Z",
        periodEndUtc: "2026-10-10T10:30:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      pumpedStorageMw: {
        value: null,
        unit: "MW",
        periodStartUtc: null,
        periodEndUtc: null,
        source: "Elexon BMRS",
        definition: "test",
      },
      shares: [],
      generationRows: rows,
      mixSnapshot: snapshot(),
      referenceTimestamp: "2026-10-10 11:00:00",
    },
    snapshots: [snapshot()],
    headlineSnapshots: [snapshot()],
    generationHistory: rows,
    headlineGeneration: rows,
    prices: [],
    records: emptyRecordsWithDocumentedCoal(new Date("2026-10-10T12:00:00.000Z")),
    historicView: null,
    transitionView: null,
    lookAhead: null,
  };
}

function deps(overrides: Partial<WebMcpDeps> = {}): WebMcpDeps {
  return {
    now: () => new Date("2026-11-24T12:00:00.000Z"),
    readEmbedded: () => null,
    fetchJson: () => Promise.reject(new Error("unexpected fetch")),
    loadAssets: () => Promise.resolve([]),
    loadProjects: () => Promise.resolve([]),
    page: () => ({ title: "Grid", url: "https://grid.vahaah.com/", path: "/" }),
    ...overrides,
  };
}

const signal = () => new AbortController().signal;

describe("WebMCP handlers", () => {
  it("reads the mix, carbon and prices from the page snapshot and refuses a date", async () => {
    const reading = liveReadingFromPayload(payload(), "2026-11-24T12:00:00.000Z");
    expect(reading?.topFuel?.toLowerCase()).toContain("wind");
    expect(reading?.carbon?.gramsPerKwh).toBe(148);
    expect(reading?.marketIndex?.series).toBe("Market Index (APXMIDP)");
    expect(reading?.marketIndex?.gbpPerMwh).toBe(45.2);
    expect(reading?.imbalance.gbpPerMwh).toBe(67);
    expect(reading?.imbalance.series).toContain("imbalance");
    expect(reading?.greenest).toBeNull();
    expect(reading?.sources.map((source) => source.name)).toEqual([
      "Elexon BMRS",
      "NESO",
      "Carbon Intensity API",
      "Sheffield Solar PV_Live",
    ]);
    const fetches: string[] = [];
    const handlers = createWebMcpHandlers(deps({
      readEmbedded: () => ({
        version: 1,
        path: "/",
        generatedAt: "2026-11-24T12:00:00.000Z",
        reading,
        balancing: null,
      }),
      fetchJson: (url) => {
        fetches.push(url);
        return Promise.reject(new Error("should use the page"));
      },
    }));
    const mix = await handlers.getLiveMix({}, signal());
    expect(mix.data?.fuels[0]?.fuel).toBe("wind");
    expect(mix.readOnly).toBe(true);
    expect(mix.retrievedAt).toBe("2026-11-24T12:00:00.000Z");
    expect(mix.sources.length).toBeGreaterThan(0);
    const blocked = await handlers.getLiveMix({ date: "2026-01-01" }, signal());
    expect(blocked.data).toBeNull();
    expect(blocked.notice).toBe("This tool does not read a historical date.");
    expect(fetches).toEqual([]);
    const historical = liveReadingFromPayload({ ...payload(), facts: { ...payload().facts, isHistorical: true } }, "2026-11-24T12:00:00.000Z");
    expect(historical).toBeNull();
  });

  it("peeks the latest dashboard and the cleanest window without a date", async () => {
    const body = payload();
    const fetches: string[] = [];
    const handlers = createWebMcpHandlers(deps({
      fetchJson: (url) => {
        assertNoHistoricalDate(url);
        fetches.push(url);
        if (url === LOOK_AHEAD_PATH) {
          return Promise.resolve({
            fetchedAt: "2026-11-24T11:00:00.000Z",
            greenestWindow: {
              startUtc: "2026-11-24T14:00:00.000Z",
              endUtc: "2026-11-24T16:00:00.000Z",
              grams: 40,
              sentence: "Cleanest window.",
            },
            carbonSeries: [{ time: "secret", value: 1 }],
          });
        }
        return Promise.resolve(body);
      },
    }));
    const carbon = await handlers.getCarbonIntensity({}, signal());
    expect(carbon.data?.carbon?.unit).toBe("gCO₂/kWh");
    expect(carbon.data?.greenest?.gramsPerKwh).toBe(40);
    expect(carbon.data?.greenest).not.toHaveProperty("carbonSeries");
    expect(fetches).toEqual([LIVE_DASHBOARD_PATH, LOOK_AHEAD_PATH]);
    expect(LIVE_DASHBOARD_PATH).not.toContain("date=");
    expect(() => assertNoHistoricalDate("/api/dashboard?period=day&date=2026-01-01")).toThrow(/historical date/);
    const price = await handlers.getWholesalePrice({}, signal());
    expect(price.data?.marketIndex?.gbpPerMwh).toBe(45.2);
    expect(fetches.filter((url) => url === LIVE_DASHBOARD_PATH)).toHaveLength(1);
  });

  it("keeps a metric when an unrelated figure is missing", async () => {
    const priced = payload();
    priced.facts.price = { ...priced.facts.price, value: null };
    const withoutMarket = liveReadingFromPayload(priced, "2026-11-24T12:00:00.000Z");
    expect(withoutMarket?.fuels[0]?.fuel).toBe("wind");
    expect(withoutMarket?.carbon?.gramsPerKwh).toBe(148);
    expect(withoutMarket?.marketIndex).toBeNull();
    expect(withoutMarket?.imbalance.gbpPerMwh).toBe(67);

    const carbonless = payload();
    carbonless.facts.carbon = { ...carbonless.facts.carbon, value: null };
    carbonless.facts.systemPrice = { ...carbonless.facts.systemPrice, value: null };
    const withoutCarbon = liveReadingFromPayload(carbonless, "2026-11-24T12:00:00.000Z");
    expect(withoutCarbon?.carbon).toBeNull();
    expect(withoutCarbon?.marketIndex?.gbpPerMwh).toBe(45.2);
    expect(withoutCarbon?.fuels.length).toBeGreaterThan(0);

    const handlers = createWebMcpHandlers(deps({
      readEmbedded: () => ({
        version: 1,
        path: "/",
        generatedAt: "2026-11-24T12:00:00.000Z",
        reading: withoutMarket,
        balancing: null,
      }),
    }));
    const mix = await handlers.getLiveMix({}, signal());
    const carbon = await handlers.getCarbonIntensity({}, signal());
    const price = await handlers.getWholesalePrice({}, signal());
    expect(mix.data?.fuels.length).toBeGreaterThan(0);
    expect(carbon.data?.carbon?.gramsPerKwh).toBe(148);
    expect(price.data?.marketIndex).toBeNull();
    expect(price.data?.imbalance?.gbpPerMwh).toBe(67);
    expect(price.notice).toMatch(/Market Index price is not in this reading/);
  });

  it("replaces a snapshot once it is older than the dashboard cache, and again when the tab is shown", async () => {
    const staleReading = liveReadingFromPayload(payload(), "2026-11-24T11:50:00.000Z");
    const refreshed = payload();
    refreshed.facts.carbon = { ...refreshed.facts.carbon, value: 90 };
    const fetches: string[] = [];
    let now = new Date("2026-11-24T12:00:00.000Z");
    const handlers = createWebMcpHandlers(deps({
      now: () => now,
      readEmbedded: () => ({
        version: 1,
        path: "/",
        generatedAt: "2026-11-24T11:50:00.000Z",
        reading: staleReading,
        balancing: null,
      }),
      fetchJson: (url) => {
        fetches.push(url);
        return Promise.resolve(refreshed);
      },
    }));
    const mix = await handlers.getLiveMix({}, signal());
    expect(mix.data?.carbon?.gramsPerKwh).toBe(90);
    await handlers.getLiveMix({}, signal());
    expect(fetches.filter((url) => url === LIVE_DASHBOARD_PATH)).toHaveLength(1);
    now = new Date(now.getTime() + CLIENT_QUERY_MAX_AGE_MS);
    await handlers.getLiveMix({}, signal());
    expect(fetches.filter((url) => url === LIVE_DASHBOARD_PATH)).toHaveLength(2);

    const listeners = new Map<string, () => void>();
    const doc = {
      visibilityState: "hidden",
      addEventListener: (type: string, fn: () => void) => {
        listeners.set(type, fn);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    };
    const previous = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
    try {
      let calls = 0;
      const watched = createWebMcpHandlers(deps({
        fetchJson: () => {
          calls += 1;
          return Promise.resolve(payload());
        },
      }));
      await watched.getLiveMix({}, signal());
      doc.visibilityState = "visible";
      listeners.get("visibilitychange")?.();
      await watched.getLiveMix({}, signal());
      expect(calls).toBe(2);
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: previous });
    }
  });

  it("returns the published price cap and leaves January 2027 empty", async () => {
    const handlers = createWebMcpHandlers(deps());
    const cap = await handlers.getPriceCap({});
    expect(cap.data?.current.typicalDualFuelDirectDebitGbp).toBe(1723);
    expect(cap.data?.current).toBe(CURRENT_PRICE_CAP);
    expect(cap.data?.january2027).toBeNull();
    expect(cap.data?.nextAnnouncementLabel).toBe("25 November 2026");
    expect(cap.sources[0]?.attribution).toBe("Source: Ofgem.");
    expect(cap.data?.sentence).toContain("does not show a January 2027 cap");
  });

  it("searches pages, projects and assets with the header ranking", async () => {
    const loads = { assets: 0, projects: 0 };
    const handlers = createWebMcpHandlers(deps({
      loadAssets: () => {
        loads.assets += 1;
        return Promise.resolve([sizewell]);
      },
      loadProjects: () => {
        loads.projects += 1;
        return Promise.resolve([eurocell]);
      },
    }));
    const pages = await handlers.searchGrid({ query: "" }, signal());
    expect(pages.data?.hits.map((hit) => hit.href)).toContain("/explained/price-cap");
    expect(loads).toEqual({ assets: 0, projects: 0 });
    const found = await handlers.searchGrid({ query: "eurocell nickel" }, signal());
    expect(found.data?.hits[0]?.href).toContain("/projects/epj_3415e2e58a0ec470/");
    const station = await handlers.searchGrid({ query: "Sizewell" }, signal());
    expect(station.data?.hits.find((hit) => hit.kind === "asset")?.title).toBe("Sizewell B");
    expect(station.sources.some((source) => source.attribution === OGL_V3_ATTRIBUTION)).toBe(true);
    const long = await handlers.searchGrid({ query: "x".repeat(81) }, signal());
    expect(long.data).toBeNull();
    const meter = await handlers.searchGrid({ query: "mpan" }, signal());
    expect(meter.data?.hits.every((hit) => !hit.href.includes("mpan"))).toBe(true);
    expect(meter.notice).toMatch(/MPAN/);
  });

  it("describes the current page and the balancing card without a second fetch", async () => {
    const fetches: string[] = [];
    const handlers = createWebMcpHandlers(deps({
      page: () => ({ title: "GB gas", url: "https://grid.vahaah.com/gas", path: "/gas" }),
      readEmbedded: () => ({
        version: 1,
        path: "/",
        generatedAt: "2026-11-24T12:00:00.000Z",
        reading: liveReadingFromPayload(payload(), "2026-11-24T12:00:00.000Z"),
        balancing: {
          schema_version: 1,
          latest_date: "2026-11-23",
          latest_pence: 12_500_000,
          latest_periods: 48,
          latest_expected_periods: 48,
          latest_incomplete: false,
          financial_year: "2026-2027",
          fy_pence: 250_000_000,
          fy_from: "2026-04-01",
          fy_through: "2026-11-23",
          missing_dates: [],
          constraints_share: 0.42,
          tariff_gbp_per_mwh: 12.34,
          tariff_label: "Final tariff",
          household_pence: 3085,
          generated_at: "2026-11-24T08:00:00.000Z",
        },
      }),
      fetchJson: (url) => {
        fetches.push(url);
        return Promise.reject(new Error("no fetch"));
      },
    }));
    const page = await handlers.getPageDataset({}, signal());
    expect(page.data?.path).toBe("/gas");
    expect(page.data?.figures).toBeNull();
    expect(page.sources.some((source) => source.attribution === NATIONAL_GAS_ATTRIBUTION)).toBe(true);
    const link = createWebMcpHandlers(deps({
      page: () => ({
        title: "IFA",
        url: "https://grid.vahaah.com/assets/ast_5c5dc7c6656c3f93/ifa",
        path: "/assets/ast_5c5dc7c6656c3f93/ifa",
      }),
      loadAssets: () => Promise.resolve([{ ...sizewell, id: "ast_5c5dc7c6656c3f93", name: "IFA", technology: "interconnector", source: "Elexon", sources: ["Elexon"] }]),
    }));
    const ifa = await link.getPageDataset({}, signal());
    expect(ifa.sources.map((source) => source.attribution)).toEqual([
      "Grid's derived data is CC BY 4.0. Upstream licences still apply.",
      elexonBmrsAttribution(2026),
      GEONAMES_ATTRIBUTION,
    ]);
    expect(ifa.sources.some((source) => source.attribution === OGL_V3_ATTRIBUTION)).toBe(false);
    const terminal = createWebMcpHandlers(deps({
      page: () => ({
        title: "Bacton",
        url: "https://grid.vahaah.com/assets/ast_0789b8c8f94ec14a/bacton-ips",
        path: "/assets/ast_0789b8c8f94ec14a/bacton-ips",
      }),
      loadAssets: () => Promise.resolve([{ ...sizewell, id: "ast_0789b8c8f94ec14a", name: "Bacton", technology: "gas_terminal", source: "National Gas", sources: ["National Gas"] }]),
    }));
    const bacton = await terminal.getPageDataset({}, signal());
    expect(bacton.sources.some((source) => source.attribution === NATIONAL_GAS_ATTRIBUTION)).toBe(true);
    expect(bacton.sources.some((source) => source.attribution === GEONAMES_ATTRIBUTION)).toBe(true);
    expect(bacton.sources.some((source) => source.attribution === OGL_V3_ATTRIBUTION)).toBe(false);
    const plant = createWebMcpHandlers(deps({
      page: () => ({
        title: "Sizewell B",
        url: "https://grid.vahaah.com/assets/ast_0000000000000001/sizewell-b",
        path: "/assets/ast_0000000000000001/sizewell-b",
      }),
      loadAssets: () => Promise.resolve([sizewell]),
    }));
    const station = await plant.getPageDataset({}, signal());
    expect(station.sources.some((source) => source.attribution === OGL_V3_ATTRIBUTION)).toBe(true);
    expect(station.sources.some((source) => source.attribution === NATIONAL_GAS_ATTRIBUTION)).toBe(false);
    const balancing = await handlers.getBalancingSummary({}, signal());
    expect(balancing.data?.financialYearLabel).toBe("2026/27");
    expect(balancing.data?.latestPence).toBe(12_500_000);
    expect(balancing.data?.householdPounds).toBeTruthy();
    expect(balancing.notice).toMatch(/not part of this balancing cost/);
    expect(fetches).toEqual([]);
  });

  it("summarises data health and leaves a missing pointer as not yet available", async () => {
    const handlers = createWebMcpHandlers(deps({
      fetchJson: (url) => {
        expect(url).toBe("/api/v1/data-health");
        expect(url).not.toContain("date=");
        return Promise.resolve({
          checkedAt: "2026-11-24T12:00:00.000Z",
          readings: [
            {
              metric_id: "elec.gb.demand.itsdo",
              label: "Demand",
              unit: "MW",
              source: "Elexon BMRS",
              value: 32000,
              published_at: "2026-11-24T11:30:00.000Z",
              retrieved_at: "2026-11-24T11:35:00.000Z",
              stale: false,
              state: "fresh",
            },
          ],
        });
      },
    }));
    const health = await handlers.getDataHealth({}, signal());
    expect(health.data?.fresh).toBe(1);
    expect(health.data?.readings[0]?.published_at).toBe("2026-11-24T11:30:00.000Z");
    const missing = createWebMcpHandlers(deps({
      fetchJson: () => Promise.resolve({ error: "The source is unavailable. The last published data is still returned where Grid holds it." }),
    }));
    const down = await missing.getDataHealth({}, signal());
    expect(down.data).toBeNull();
    expect(down.notice).toBe("Not yet available.");
  });

  it("registers only the read-only Grid tools and skips a document without the API", async () => {
    expect(modelContextFor({})).toBeNull();
    expect(modelContextFor({ modelContext: {} })).toBeNull();
    const registered: { name: string; readOnly: boolean; signal: AbortSignal }[] = [];
    const controller = new AbortController();
    await registerGridTools(
      {
        registerTool: (tool, options) => {
          const record = tool as { name: string; annotations?: { readOnlyHint?: boolean } };
          registered.push({
            name: record.name,
            readOnly: record.annotations?.readOnlyHint === true,
            signal: options?.signal ?? controller.signal,
          });
          return Promise.resolve();
        },
      },
      controller.signal,
      deps(),
    );
    expect(registered.map((tool) => tool.name).sort()).toEqual([
      "get_balancing_summary",
      "get_carbon_intensity",
      "get_data_health",
      "get_live_mix",
      "get_page_dataset",
      "get_price_cap",
      "get_wholesale_price",
      "search_grid",
    ]);
    expect(registered.every((tool) => tool.readOnly && tool.signal === controller.signal)).toBe(true);
    const aborted = new AbortController();
    aborted.abort();
    const late: string[] = [];
    await registerGridTools(
      {
        registerTool: (tool) => {
          late.push((tool as { name: string }).name);
          return Promise.resolve();
        },
      },
      aborted.signal,
      deps(),
    );
    expect(late).toEqual([]);
    for (const route of SHIPPED_PAGE_ROUTES) {
      expect(sourcesForPath(route, 2026).length).toBeGreaterThan(0);
    }
    const escaped = embeddedWebMcpJson({
      version: 1,
      path: "/",
      generatedAt: "2026-11-24T12:00:00.000Z",
      reading: null,
      balancing: null,
    });
    expect(escaped).not.toContain("<");
    expect(parseEmbeddedWebMcp(JSON.parse(escaped))?.path).toBe("/");
    expect(WEBMCP_ORIGIN_TRIAL_TOKEN).toBe("");
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    const island = readFileSync(resolve(process.cwd(), "src/app/webmcp-registrar.tsx"), "utf8");
    const registrar = readFileSync(resolve(process.cwd(), "src/lib/webmcp/register.ts"), "utf8");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(home).toContain("WEBMCP_PAGE_SCRIPT_ID");
    expect(home).not.toContain("maplibre");
    expect(island).toContain('import("@/lib/webmcp/register")');
    expect(island).not.toContain("maplibre");
    expect(island).not.toContain("@w3c/webmcp-polyfill");
    expect(island).not.toContain("@ui-sdk");
    expect(registrar).not.toContain("registerTools");
    expect(registrar).not.toContain("maplibre");
  });
});
