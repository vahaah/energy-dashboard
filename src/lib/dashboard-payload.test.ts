import { beforeEach, describe, expect, it, vi } from "vitest";

const queryPipe = vi.fn();
const getHistoricPeriodView = vi.fn();
const getGridRecords = vi.fn();
const getLookAhead = vi.fn();

vi.mock("@/lib/tinybird", () => ({
  queryPipe: (...args: unknown[]) => queryPipe(...args),
}));

vi.mock("@/lib/neso-historic", () => ({
  getHistoricPeriodView: (...args: unknown[]) => getHistoricPeriodView(...args),
  getGridRecords: (...args: unknown[]) => getGridRecords(...args),
}));

vi.mock("@/lib/forecasts", () => ({
  getLookAhead: (...args: unknown[]) => getLookAhead(...args),
}));

import {
  compactDashboardPayload,
  compactHistoricPayload,
  dashboardPayloadCacheDate,
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  downsampleGeneration,
  headlineWindow,
  hydrateDashboardPayload,
  loadDashboardPayloadUncached,
  payloadJsonBytes,
} from "@/lib/dashboard-payload";
import { buildHistoricPeriodView, emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";

describe("dashboard payload", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");

  beforeEach(() => {
    queryPipe.mockReset();
    getHistoricPeriodView.mockReset();
    getGridRecords.mockReset();
    getLookAhead.mockReset();
    queryPipe.mockResolvedValue([]);
    getHistoricPeriodView.mockResolvedValue(buildHistoricPeriodView([]));
    getGridRecords.mockResolvedValue(emptyRecordsWithDocumentedCoal(now));
    getLookAhead.mockResolvedValue(null);
  });

  it("builds Week headlines from unaggregated latest rows, not the hourly series", async () => {
    queryPipe.mockImplementation((pipe: string, params: Record<string, string> = {}) => {
      if (pipe === "snapshots_range") {
        return Promise.resolve([
          {
            timestamp: "2026-10-10 11:30:00",
            carbon_intensity: 80,
            carbon_forecast: 80,
            carbon_index: "low",
            demand_mw: 30_000,
            price_gbp_mwh: 50,
            gen_gas_pct: 30,
            gen_coal_pct: 0,
            gen_nuclear_pct: 15,
            gen_wind_pct: 35,
            gen_solar_pct: 5,
            gen_hydro_pct: 5,
            gen_biomass_pct: 5,
            gen_imports_pct: 5,
            gen_other_pct: 0,
            gen_gas_mw: 6000,
            gen_coal_mw: 0,
            gen_nuclear_mw: 3000,
            gen_wind_mw: 7000,
            gen_solar_mw: 1000,
            gen_hydro_mw: 1000,
            gen_biomass_mw: 1000,
            gen_other_mw: 0,
          },
        ]);
      }

      if (pipe === "generation_5min_range") {
        if (params.granularity === "hour") {
          return Promise.resolve([
            {
              timestamp: "2026-10-10 11:00:00",
              fuel_type: "wind",
              generation_mw: 8000,
              source: "fuelinst",
            },
            {
              timestamp: "2026-10-10 11:00:00",
              fuel_type: "ccgt",
              generation_mw: 7000,
              source: "fuelinst",
            },
          ]);
        }

        return Promise.resolve([
          {
            timestamp: "2026-10-10 11:30:00",
            fuel_type: "wind",
            generation_mw: 4000,
            source: "fuelinst",
          },
          {
            timestamp: "2026-10-10 11:30:00",
            fuel_type: "ccgt",
            generation_mw: 2000,
            source: "fuelinst",
          },
        ]);
      }

      return Promise.resolve([]);
    });

    const payload = await loadDashboardPayloadUncached({
      period: "week",
      now,
    });

    expect(payload.facts.generationMw.value).toBe(6000);
    expect(payload.facts.demand.value).toBe(30_000);
    expect(payload.facts.generationRows.some((row) => row.timestamp === "2026-10-10 11:30:00")).toBe(
      true
    );
    expect(payload.facts.generationRows.some((row) => row.timestamp === "2026-10-10 11:00:00")).toBe(
      false
    );

    const generationCalls = queryPipe.mock.calls.filter((call) => call[0] === "generation_5min_range");
    expect(generationCalls).toHaveLength(2);
    const granularities = generationCalls.map((call) => {
      const params = call[1];
      if (params && typeof params === "object" && "granularity" in params) {
        return params.granularity;
      }
      return undefined;
    });
    expect(granularities).toContain("hour");
    expect(granularities).toContain(undefined);
  });

  it("uses Tinybird for Day and skips grid pipes for Year", async () => {
    await loadDashboardPayloadUncached({
      period: "day",
      now,
    });
    expect(queryPipe).toHaveBeenCalled();
    expect(queryPipe.mock.calls.some((call) => call[0] === "snapshots_range")).toBe(true);
    expect(queryPipe.mock.calls.some((call) => call[0] === "generation_5min_range")).toBe(true);
    expect(queryPipe.mock.calls.some((call) => call[0] === "prices_range")).toBe(false);
    expect(queryPipe.mock.calls).toHaveLength(2);

    queryPipe.mockClear();
    await loadDashboardPayloadUncached({
      period: "year",
      now,
    });
    expect(queryPipe).not.toHaveBeenCalled();
    expect(getHistoricPeriodView).toHaveBeenCalledWith("year", now);
  });

  it("uses historical cache for NESO periods and live cache for Day", () => {
    expect(dashboardPayloadPolicy("day").tier).toBe("live");
    expect(dashboardPayloadPolicy("year").tier).toBe("historical");
    expect(dashboardPayloadPolicy("all").tier).toBe("historical");
  });

  it("keeps out-of-coverage dates off the live Day key", () => {
    expect(
      dashboardPayloadCacheDate(
        {
          status: "empty",
          date: "2010-01-01",
          today: "2026-10-10",
          coverageStart: "2025-10-10",
        },
        "2010-01-01"
      )
    ).toBe("2010-01-01");
    expect(
      dashboardPayloadCacheDate(
        {
          status: "latest",
          date: "2026-10-10",
          today: "2026-10-10",
          coverageStart: "2025-10-10",
        },
        null
      )
    ).toBeNull();
  });

  it("rethrows a mandatory snapshots_range failure instead of returning empty data", async () => {
    queryPipe.mockImplementation((pipe: string) => {
      if (pipe === "snapshots_range") {
        return Promise.reject(new Error("tinybird down"));
      }
      return Promise.resolve([]);
    });

    await expect(
      loadDashboardPayloadUncached({
        period: "day",
        now,
      })
    ).rejects.toThrow("tinybird down");
  });

  it("rethrows a required Year historic-view failure", async () => {
    getHistoricPeriodView.mockImplementation((period: string) => {
      if (period === "year") {
        return Promise.reject(new Error("neso down"));
      }
      return Promise.resolve(buildHistoricPeriodView([]));
    });

    await expect(
      loadDashboardPayloadUncached({
        period: "year",
        now,
      })
    ).rejects.toThrow("neso down");
  });

  it("still loads Day when the optional all-time transition view fails", async () => {
    getHistoricPeriodView.mockRejectedValue(new Error("neso down"));

    await expect(
      loadDashboardPayloadUncached({
        period: "day",
        now,
      })
    ).resolves.toMatchObject({ period: "day", historicView: null });
  });

  it("serializes the all-time historic series once", async () => {
    const historic = buildHistoricPeriodView([]);
    historic.snapshots = [{ timestamp: "2026-01-01 00:00:00" } as never];
    historic.generation = [{ timestamp: "2026-01-01 00:00:00", fuel_type: "wind" } as never];
    getHistoricPeriodView.mockResolvedValue(historic);

    const payload = await loadDashboardPayloadUncached({
      period: "all",
      now,
    });
    expect(payload.historicView).toBeTruthy();
    expect(payload.transitionView).toBeNull();
    expect(payload.snapshots).toEqual([]);
    expect(payload.generationHistory).toEqual([]);
    const hydrated = hydrateDashboardPayload(payload);
    expect(hydrated.snapshots.map((row) => row.timestamp)).toEqual(["2026-01-01 00:00:00"]);
    expect(hydrated.generationHistory.map((row) => row.fuel_type)).toEqual(["wind"]);
    expect(hydrated.transitionView?.yearly).toEqual(historic.yearly);
    expect(compactHistoricPayload(hydrated).transitionView).toBeNull();
    expect(payload.prices).toEqual([]);
  });

  it("publishes only the public look-ahead shape", async () => {
    getLookAhead.mockResolvedValue({
      fetchedAt: "2026-10-10T12:00:00.000Z",
      greenest: {
        startUtc: "2026-10-10T13:00Z",
        endUtc: "2026-10-10T15:00Z",
        grams: 43,
        sentence: "Cleanest window",
      },
      carbonSeries: [{ time: "2026-10-10 13:00:00", value: 40 }],
      wind: {
        tonightGw: 11,
        tomorrowEveningGw: 8,
        sparkline: [11, 8],
        sentence: "Wind falls",
        basis: "Transmission-connected wind only. Embedded wind is not in this forecast.",
      },
      demandSeries: [{ time: "2026-10-10 13:00:00", value: 19_500 }],
    });

    const payload = await loadDashboardPayloadUncached({
      period: "day",
      now,
    });
    expect(payload.lookAhead?.greenestWindow?.grams).toBe(43);
    expect(payload.lookAhead).not.toHaveProperty("carbonSeries");
    expect(payload.lookAhead).not.toHaveProperty("demandSeries");
    expect(JSON.stringify(payload.lookAhead)).not.toContain("13:00:00");
  });

  it("keeps the cache key off commodityRange and downsamples Week generation", () => {
    expect(dashboardPayloadCacheKey("week", null)).toBe("dashboard:week:");
    const rows = [
      { timestamp: "2026-10-10 00:05:00", fuel_type: "wind", generation_mw: 1000, source: "fuelinst" },
      { timestamp: "2026-10-10 00:10:00", fuel_type: "wind", generation_mw: 2000, source: "fuelinst" },
      { timestamp: "2026-10-10 01:05:00", fuel_type: "wind", generation_mw: 3000, source: "fuelinst" },
    ];
    expect(downsampleGeneration(rows, "day")).toHaveLength(3);
    expect(downsampleGeneration(rows, "week")).toEqual([
      { timestamp: "2026-10-10 00:00:00", fuel_type: "wind", generation_mw: 1500, source: "fuelinst" },
      { timestamp: "2026-10-10 01:00:00", fuel_type: "wind", generation_mw: 3000, source: "fuelinst" },
    ]);
    expect(headlineWindow(rows)).toEqual(rows);
  });

  it("cuts a fat Week payload well below the live 3.58 MB dump", () => {
    const generationHistory = Array.from({ length: 20_160 }, (_, index) => ({
      timestamp: `2026-10-03 ${String(Math.floor(index / 12) % 24).padStart(2, "0")}:${String((index * 5) % 60).padStart(2, "0")}:00`,
      fuel_type: `fuel${index % 20}`,
      generation_mw: 100 + (index % 50),
      source: "fuelinst",
    }));
    const snapshots = Array.from({ length: 336 }, (_, index) => ({
      timestamp: `2026-10-03 ${String(Math.floor(index / 2) % 24).padStart(2, "0")}:${String((index % 2) * 30).padStart(2, "0")}:00`,
      carbon_intensity: 80,
      carbon_forecast: 80,
      carbon_index: "low",
      demand_mw: 30_000,
      price_gbp_mwh: 50,
      gen_gas_pct: 30,
      gen_coal_pct: 0,
      gen_nuclear_pct: 15,
      gen_wind_pct: 35,
      gen_solar_pct: 5,
      gen_hydro_pct: 5,
      gen_biomass_pct: 5,
      gen_imports_pct: 5,
      gen_other_pct: 0,
      gen_gas_mw: 6000,
      gen_coal_mw: 0,
      gen_nuclear_mw: 3000,
      gen_wind_mw: 7000,
      gen_solar_mw: 1000,
      gen_hydro_mw: 1000,
      gen_biomass_mw: 1000,
      gen_other_mw: 0,
    }));
    const historic = buildHistoricPeriodView([]);
    historic.snapshots = snapshots;
    historic.generation = generationHistory;

    const fat = {
      period: "week" as const,
      chartRange: "7d" as const,
      dateResolution: {
        status: "latest" as const,
        date: "2026-10-10",
        today: "2026-10-10",
        coverageStart: "2025-10-10",
      },
      facts: {} as never,
      snapshots,
      headlineSnapshots: snapshots.slice(-48),
      generationHistory,
      headlineGeneration: generationHistory.slice(-2880),
      prices: Array.from({ length: 400 }, (_, index) => ({
        date: "2026-09-01",
        commodity: "brent_crude",
        price: 70 + index,
        currency: "USD",
        unit: "$/BBL",
      })),
      records: null,
      historicView: null,
      transitionView: historic,
      lookAhead: null,
    };
    const compact = compactDashboardPayload(fat);
    const before = payloadJsonBytes(fat);
    const after = payloadJsonBytes(compact);
    expect(before).toBeGreaterThan(3_000_000);
    expect(after).toBeLessThan(1_000_000);
    expect(compact.prices).toEqual([]);
    expect(compact.headlineGeneration).toEqual([]);
    expect(compact.transitionView?.generation).toEqual([]);
    expect(compact.generationHistory.length).toBeLessThan(generationHistory.length / 4);
  });

  it("averages All-time monthly snapshots by each field's non-missing count", () => {
    const historic = buildHistoricPeriodView([]);
    historic.snapshots = [
      {
        timestamp: "2026-01-10 00:00:00",
        carbon_intensity: 100,
        carbon_forecast: 100,
        carbon_index: "low",
        demand_mw: 30_000,
        price_gbp_mwh: 50,
        gen_gas_pct: 30,
        gen_coal_pct: 0,
        gen_nuclear_pct: 15,
        gen_wind_pct: 35,
        gen_solar_pct: 5,
        gen_hydro_pct: 5,
        gen_biomass_pct: 5,
        gen_imports_pct: 5,
        gen_other_pct: 0,
        gen_gas_mw: 6000,
        gen_coal_mw: 0,
        gen_nuclear_mw: 3000,
        gen_wind_mw: 7000,
        gen_solar_mw: 1000,
        gen_hydro_mw: 1000,
        gen_biomass_mw: 1000,
        gen_other_mw: 0,
      },
      {
        timestamp: "2026-01-20 00:00:00",
        carbon_intensity: null,
        carbon_forecast: null,
        carbon_index: "low",
        demand_mw: 20_000,
        price_gbp_mwh: null,
        gen_gas_pct: 10,
        gen_coal_pct: 0,
        gen_nuclear_pct: 15,
        gen_wind_pct: 55,
        gen_solar_pct: 5,
        gen_hydro_pct: 5,
        gen_biomass_pct: 5,
        gen_imports_pct: 5,
        gen_other_pct: 0,
        gen_gas_mw: 2000,
        gen_coal_mw: 0,
        gen_nuclear_mw: 3000,
        gen_wind_mw: 11_000,
        gen_solar_mw: 1000,
        gen_hydro_mw: 1000,
        gen_biomass_mw: 1000,
        gen_other_mw: 0,
      },
    ];

    const compact = compactDashboardPayload({
      period: "all",
      chartRange: "1y",
      dateResolution: {
        status: "latest",
        date: "2026-10-10",
        today: "2026-10-10",
        coverageStart: "2009-01-01",
      },
      facts: {} as never,
      snapshots: [],
      headlineSnapshots: [],
      generationHistory: [],
      headlineGeneration: [],
      prices: [],
      records: null,
      historicView: historic,
      transitionView: null,
      lookAhead: null,
    });

    const [month] = compact.historicView?.snapshots ?? [];
    expect(month?.timestamp).toBe("2026-01-01 00:00:00");
    expect(month?.carbon_intensity).toBe(100);
    expect(month?.carbon_forecast).toBe(100);
    expect(month?.demand_mw).toBe(25_000);
    expect(month?.price_gbp_mwh).toBe(50);
    expect(month?.gen_wind_mw).toBe(9000);
  });
});

