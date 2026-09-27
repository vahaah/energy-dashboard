import { describe, expect, it } from "vitest";
import { buildGenerationStackSeries } from "@/lib/dashboard-model";
import { resolveDashboardDate } from "@/lib/dashboard-search-params";
import { formatLondonDateTimeStamp } from "@/lib/london-time";
import type { EnergySnapshot, Generation5min } from "@/lib/types";
import { getLatestFacts, supplyShares } from "@/lib/facts";

function makeSnapshot(overrides: Partial<EnergySnapshot> = {}): EnergySnapshot {
  return {
    timestamp: "2026-09-27 16:00:00",
    carbon_intensity: 48,
    carbon_forecast: 48,
    carbon_index: "low",
    demand_mw: 29400,
    price_gbp_mwh: 127,
    gen_gas_pct: 20,
    gen_coal_pct: 0,
    gen_nuclear_pct: 15,
    gen_wind_pct: 45,
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
    ...overrides,
  };
}

function makeGeneration(
  timestamp: string,
  fuelType: string,
  generationMw: number,
  source = "fuelinst"
): Generation5min {
  return {
    timestamp,
    fuel_type: fuelType,
    generation_mw: generationMw,
    source,
  };
}

describe("getLatestFacts", () => {
  it("uses that day's last settlement period for a past date", () => {
    const now = new Date("2026-09-27T16:00:00.000Z");
    const facts = getLatestFacts({
      resolution: resolveDashboardDate("2026-09-20", now),
      snapshots: [
        makeSnapshot({
          timestamp: "2026-09-20 22:00:00",
          carbon_intensity: 90,
          demand_mw: 24000,
          price_gbp_mwh: 55,
        }),
        makeSnapshot({
          timestamp: "2026-09-20 22:30:00",
          carbon_intensity: 81,
          demand_mw: 25100,
          price_gbp_mwh: 40,
        }),
        makeSnapshot({
          timestamp: "2026-09-27 16:00:00",
          carbon_intensity: 48,
          demand_mw: 29400,
          price_gbp_mwh: 127,
        }),
      ],
      generation: [
        makeGeneration("2026-09-20 22:30:00", "wind", 12000),
        makeGeneration("2026-09-20 22:30:00", "ccgt", 8000),
        makeGeneration("2026-09-20 22:30:00", "INTFR", 1500),
        makeGeneration("2026-09-27 16:00:00", "wind", 14300),
        makeGeneration("2026-09-27 16:00:00", "ccgt", 4000),
      ],
      now,
    });

    expect(facts.empty).toBe(false);
    expect(facts.isHistorical).toBe(true);
    expect(facts.carbon.value).toBe(81);
    expect(facts.demand.value).toBe(25100);
    expect(facts.price.value).toBe(40);
    expect(facts.generationMw.value).toBe(20000);
    expect(facts.netImportsMw.value).toBe(1500);
    expect(facts.stamp).toBe("Sun 20 Sep 2026, 23:30 BST");
    expect(facts.headerStamp).toBe("Data as of Sun 20 Sep 2026, 23:30 BST");
    expect(facts.carbon.periodStartUtc).toBe("2026-09-20T22:30:00.000Z");
  });

  it("gives an empty state with Go to latest for 2015-01-01 and 2030-01-01", () => {
    const now = new Date("2026-09-27T16:00:00.000Z");
    const liveSnapshots = [makeSnapshot()];
    const liveGeneration = [makeGeneration("2026-09-27 16:00:00", "wind", 14000)];

    const past = getLatestFacts({
      resolution: resolveDashboardDate("2015-01-01", now),
      snapshots: liveSnapshots,
      generation: liveGeneration,
      now,
    });
    const future = getLatestFacts({
      resolution: resolveDashboardDate("2030-01-01", now),
      snapshots: liveSnapshots,
      generation: liveGeneration,
      now,
    });

    expect(past.empty).toBe(true);
    expect(past.emptyState?.action).toBe("Go to latest");
    expect(past.emptyState?.href).toBe("/");
    expect(past.emptyState?.message).toBe(
      "No data for 1 Jan 2015. Coverage starts 27 Sep 2025."
    );
    expect(past.carbon.value).toBeNull();
    expect(past.demand.value).toBeNull();
    expect(past.generationMw.value).toBeNull();
    expect(past.headerStamp).toBe("No data yet. Grid refreshes every hour.");

    expect(future.empty).toBe(true);
    expect(future.emptyState?.action).toBe("Go to latest");
    expect(future.emptyState?.message).toBe(
      "No data for 1 Jan 2030. Coverage starts 27 Sep 2025."
    );
    expect(future.carbon.value).toBeNull();
  });

  it("never shows a carbon forecast as the current value", () => {
    const now = new Date("2026-09-27T16:00:00.000Z");
    const facts = getLatestFacts({
      resolution: resolveDashboardDate(null, now),
      snapshots: [
        makeSnapshot({
          timestamp: "2026-09-27 15:00:00",
          carbon_intensity: 52,
          carbon_forecast: 37,
          carbon_index: "low",
        }),
        makeSnapshot({
          timestamp: "2026-09-27 15:30:00",
          carbon_intensity: null,
          carbon_forecast: 48,
          carbon_index: "low",
        }),
      ],
      generation: [makeGeneration("2026-09-27 15:00:00", "wind", 10000)],
      now,
    });

    expect(facts.carbon.value).toBe(52);
    expect(facts.carbon.periodStartUtc).toBe("2026-09-27T15:00:00.000Z");
  });

  it("uses stale wording after 2.5 hours on the latest view", () => {
    const now = new Date("2026-09-27T18:45:00.000Z");
    const facts = getLatestFacts({
      resolution: resolveDashboardDate(null, now),
      snapshots: [
        makeSnapshot({
          timestamp: "2026-09-27 16:00:00",
          carbon_intensity: 48,
        }),
      ],
      generation: [makeGeneration("2026-09-27 16:00:00", "wind", 10000)],
      now,
    });

    expect(facts.isStale).toBe(true);
    expect(facts.stamp).toBe("Latest available (Sun 27 Sep 2026, 17:00 BST, delayed)");
    expect(facts.headerStamp).toBe(
      "Latest available (Sun 27 Sep 2026, 17:00 BST, delayed)"
    );
  });
});

describe("supplyShares", () => {
  it("sums to 100 ± 0.1", () => {
    const shares = supplyShares([
      makeGeneration("2026-09-27 16:00:00", "ccgt", 10000),
      makeGeneration("2026-09-27 16:00:00", "wind", 20000),
      makeGeneration("2026-09-27 16:00:00", "embedded_wind", 5000, "neso"),
      makeGeneration("2026-09-27 16:00:00", "ps", -400),
      makeGeneration("2026-09-27 16:00:00", "INTFR", 5400),
    ]);

    const total = shares.reduce((sum, share) => sum + share.sharePct, 0);
    expect(total).toBeGreaterThanOrEqual(99.9);
    expect(total).toBeLessThanOrEqual(100.1);
    expect(shares.find((share) => share.fuel === "imports")?.mw).toBe(5400);
  });
});

describe("generation stack buckets", () => {
  it("does not build a stack bucket from embedded rows alone", () => {
    const series = buildGenerationStackSeries(
      [
        makeGeneration("2026-09-27 16:00:00", "embedded_solar", 2400, "pvlive"),
        makeGeneration("2026-09-27 16:00:00", "embedded_wind", 3300, "neso"),
        makeGeneration("2026-09-27 16:30:00", "ccgt", 8000),
        makeGeneration("2026-09-27 16:30:00", "embedded_solar", 1800, "pvlive"),
        makeGeneration("2026-09-27 16:35:00", "solar", 999),
      ],
      "24h"
    );

    expect(series).toHaveLength(1);
    expect(series[0]?.time).toBe(new Date("2026-09-27T16:30:00.000Z").getTime());
    expect(series[0]?.gas).toBeCloseTo((8000 / 9800) * 100, 5);
    expect(series[0]?.embedded_solar).toBeCloseTo((1800 / 9800) * 100, 5);
    expect(series[0]).not.toHaveProperty("solar");
  });
});

describe("dated stamp", () => {
  it("formats a full UK date and time", () => {
    expect(formatLondonDateTimeStamp(new Date("2026-09-27T16:00:00.000Z"))).toBe(
      "Sun 27 Sep 2026, 17:00 BST"
    );
    expect(formatLondonDateTimeStamp(new Date("2026-01-15T12:00:00.000Z"))).toBe(
      "Thu 15 Jan 2026, 12:00 GMT"
    );
  });
});
