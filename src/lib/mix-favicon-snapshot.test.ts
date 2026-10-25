import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardPayload } from "@/lib/dashboard-payload-model";
import {
  loadMixFaviconSegments,
  resetMixFaviconSnapshotForTests,
} from "@/lib/mix-favicon-snapshot";
import { peekThroughCache } from "@/lib/redis-cache";
import type { EnergySnapshot } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

vi.mock("@/lib/redis-cache", () => ({
  peekThroughCache: vi.fn(),
}));

vi.mock("@/lib/warm-envelope", () => ({
  peekWarmedPipe: vi.fn(),
}));

function mixSnapshot(overrides: Partial<EnergySnapshot> = {}): EnergySnapshot {
  return {
    timestamp: "2026-10-25 20:30:00",
    carbon_intensity: 48,
    carbon_forecast: 48,
    carbon_index: "low",
    demand_mw: 30000,
    price_gbp_mwh: 70,
    price_mid_gbp_mwh: 68,
    gen_gas_pct: 16.6,
    gen_coal_pct: 0,
    gen_nuclear_pct: 16,
    gen_wind_pct: 57.1,
    gen_solar_pct: 0,
    gen_hydro_pct: 0,
    gen_biomass_pct: 4.1,
    gen_imports_pct: 6.2,
    gen_other_pct: 0,
    gen_gas_mw: null,
    gen_coal_mw: null,
    gen_nuclear_mw: null,
    gen_wind_mw: null,
    gen_solar_mw: null,
    gen_hydro_mw: null,
    gen_biomass_mw: null,
    gen_other_mw: null,
    ...overrides,
  };
}

function payload(snapshot: EnergySnapshot | null): DashboardPayload {
  return {
    facts: {
      mixSnapshot: snapshot,
      generationRows: [],
      generationMw: { periodStartUtc: null },
    },
    headlineSnapshots: [],
    snapshots: snapshot ? [snapshot] : [],
  } as unknown as DashboardPayload;
}

describe("mix favicon snapshot", () => {
  beforeEach(() => {
    resetMixFaviconSnapshotForTests();
    vi.mocked(peekThroughCache).mockReset();
    vi.mocked(peekWarmedPipe).mockReset();
  });

  it("uses the cached homepage snapshot and does not need the warmed pipe", async () => {
    vi.mocked(peekThroughCache).mockResolvedValue(payload(mixSnapshot()));
    vi.mocked(peekWarmedPipe).mockResolvedValue(null);

    const segments = await loadMixFaviconSegments(new Date("2026-10-25T21:00:00.000Z"));

    expect(peekThroughCache).toHaveBeenCalledWith("dashboard:day:", expect.any(Object));
    expect(segments.map((segment) => segment.fuel)).toEqual([
      "gas",
      "nuclear",
      "wind",
      "biomass",
      "imports",
    ]);
    expect(new Set(segments.map((segment) => segment.color)).size).toBeGreaterThanOrEqual(2);
  });

  it("keeps the last good mix when the caches miss", async () => {
    vi.mocked(peekThroughCache).mockResolvedValueOnce(payload(mixSnapshot()));
    vi.mocked(peekWarmedPipe).mockResolvedValue(null);
    const first = await loadMixFaviconSegments();

    vi.mocked(peekThroughCache).mockResolvedValueOnce(null);
    const second = await loadMixFaviconSegments();

    expect(second).toEqual(first);
    expect(second.length).toBeGreaterThanOrEqual(2);
  });

  it("reads the warmed snapshot envelope when the homepage payload has no mix", async () => {
    vi.mocked(peekThroughCache).mockResolvedValue(payload(null));
    vi.mocked(peekWarmedPipe).mockResolvedValue([mixSnapshot()]);

    const segments = await loadMixFaviconSegments();

    expect(segments.map((segment) => segment.fuel)).toContain("wind");
    expect(segments.map((segment) => segment.fuel)).toContain("gas");
  });

  it("uses generation rows when snapshot percentages are missing", async () => {
    vi.mocked(peekThroughCache).mockResolvedValue({
      facts: {
        mixSnapshot: mixSnapshot({
          gen_gas_pct: null,
          gen_coal_pct: null,
          gen_nuclear_pct: null,
          gen_wind_pct: null,
          gen_solar_pct: null,
          gen_hydro_pct: null,
          gen_biomass_pct: null,
          gen_imports_pct: null,
          gen_other_pct: null,
        }),
        generationRows: [
          {
            timestamp: "2026-10-25 20:30:00",
            fuel_type: "wind",
            generation_mw: 10000,
            source: "fuelinst",
          },
          {
            timestamp: "2026-10-25 20:30:00",
            fuel_type: "ccgt",
            generation_mw: 4000,
            source: "fuelinst",
          },
        ],
        generationMw: { periodStartUtc: null },
      },
      headlineSnapshots: [],
      snapshots: [],
    } as unknown as DashboardPayload);
    vi.mocked(peekWarmedPipe).mockResolvedValue(null);

    const segments = await loadMixFaviconSegments();

    expect(segments.map((segment) => segment.fuel)).toEqual(expect.arrayContaining(["wind", "gas"]));
    expect(new Set(segments.map((segment) => segment.color)).size).toBeGreaterThanOrEqual(2);
  });

  it("returns nothing when neither cache nor a previous mix exists", async () => {
    vi.mocked(peekThroughCache).mockResolvedValue(null);
    vi.mocked(peekWarmedPipe).mockResolvedValue([]);

    await expect(loadMixFaviconSegments()).resolves.toEqual([]);
  });
});
