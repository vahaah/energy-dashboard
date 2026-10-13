import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DISPLAYED_DEMAND_STAT,
  getDisplayedPower,
  headlineBalanceHolds,
  headlineBalanceResidualMw,
} from "@/lib/displayed-demand";
import { getLatestFacts } from "@/lib/facts";
import { resolveDashboardDate } from "@/lib/dashboard-search-params";
import type { LatestFacts } from "@/lib/facts";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

function generation(
  timestamp: string,
  fuelType: string,
  generationMw: number,
  source = "fuelinst"
): Generation5min {
  return { timestamp, fuel_type: fuelType, generation_mw: generationMw, source };
}

function fact(value: number | null, timestamp: string | null, source: string) {
  return {
    value,
    unit: "MW",
    periodStartUtc: timestamp,
    periodEndUtc: timestamp,
    source,
    definition: "test",
  };
}

function facts(generationRows: Generation5min[]): LatestFacts {
  return {
    empty: false,
    emptyState: null,
    coverageStart: "2025-09-28",
    requestedDate: "2026-09-28",
    isHistorical: false,
    isStale: false,
    stamp: null,
    headerStamp: "Data as of test",
    carbon: { ...fact(80, "2026-09-28T07:00:00.000Z", "Carbon Intensity API"), index: "low" },
    demand: fact(24000, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    price: fact(50, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    systemPrice: fact(50, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    generationMw: fact(19298, "2026-09-28T07:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
    netImportsMw: fact(396, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    pumpedStorageMw: fact(231, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    shares: [],
    generationRows,
    mixSnapshot: null,
    referenceTimestamp: "2026-09-28T07:00:00.000Z",
  };
}

function snapshot(timestamp: string, demandMw: number): EnergySnapshot {
  return {
    timestamp,
    carbon_intensity: 80,
    carbon_forecast: 80,
    carbon_index: "low",
    demand_mw: demandMw,
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
  };
}

describe("displayed demand", () => {
  it("is the embedded-inclusive figure from one selector", () => {
    const power = getDisplayedPower(
      facts([
        generation("2026-09-28 07:00:00", "ccgt", 7563),
        generation("2026-09-28 07:00:00", "wind", 3746),
        generation("2026-09-28 07:00:00", "embedded_wind", 917, "neso"),
        generation("2026-09-28 07:00:00", "embedded_solar", 800, "pvlive"),
      ]),
      [snapshot("2026-09-28 07:00:00", 24000)]
    );

    expect(DISPLAYED_DEMAND_STAT).toBe("demand");
    expect(power.balanceClosed).toBe(false);
    expect(power.showEquals).toBe(false);
    expect(power.demandMw).toBe(25717);
    expect(power.transmissionDemandMw).toBe(24000);
    expect(power.demandMw).not.toBe(power.transmissionDemandMw);
    expect(power.generationMw).toBe(19298);
  });

  it("keeps each equation term on its own settlement timestamp", () => {
    const power = getDisplayedPower(
      {
        ...facts([
          generation("2026-09-28 06:30:00", "ccgt", 8000),
          generation("2026-09-28 06:30:00", "wind", 4000),
        ]),
        demand: fact(24000, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
        generationMw: fact(12000, "2026-09-28T06:30:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(400, "2026-09-28T06:30:00.000Z", "Elexon BMRS"),
      },
      []
    );

    expect(power.demandStartUtc).toBe("2026-09-28T07:00:00.000Z");
    expect(power.generationStartUtc).toBe("2026-09-28T06:30:00.000Z");
    expect(power.transfersStartUtc).toBe("2026-09-28T06:30:00.000Z");
    expect(power.demandMw).toBeNull();
    expect(power.transmissionDemandMw).toBeNull();
  });

  it("uses the aligned transmission figure in the demand tooltip", () => {
    const power = getDisplayedPower(
      {
        ...facts([
          generation("2026-09-28 06:30:00", "ccgt", 8000),
          generation("2026-09-28 06:30:00", "embedded_wind", 500, "neso"),
        ]),
        demand: fact(24000, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
        generationMw: fact(8500, "2026-09-28T06:30:00.000Z", "Elexon BMRS"),
      },
      [snapshot("2026-09-28 06:30:00", 20000)]
    );

    expect(power.demandMw).toBe(20500);
    expect(power.transmissionDemandMw).toBe(20000);
  });

  it("balances demand = generation + transfers with Elexon import-positive interconnectors", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    const timestamp = "2026-10-10 11:00:00";
    const rows: Generation5min[] = [
      generation(timestamp, "ccgt", 15_000),
      generation(timestamp, "wind", 8_000),
      generation(timestamp, "nuclear", 5_000),
      generation(timestamp, "ps", -2_000),
      generation(timestamp, "embedded_wind", 2_000, "neso"),
      generation(timestamp, "embedded_solar", 1_000, "pvlive"),
      generation(timestamp, "intfr", 1_500),
      generation(timestamp, "intned", 500),
      generation(timestamp, "intirl", -800),
    ];
    const itsdo = 15_000 + 8_000 + 5_000 - 2_000 + 1_500 + 500 - 800;
    const facts = getLatestFacts({
      resolution: resolveDashboardDate(null, now, "24h"),
      snapshots: [snapshot(timestamp, itsdo)],
      generation: rows,
      now,
    });
    const power = getDisplayedPower(facts, [snapshot(timestamp, itsdo)]);

    expect(power.balanceClosed).toBe(true);
    expect(power.generationMw).toBe(31_000);
    expect(power.importsMw).toBe(2_000);
    expect(power.exportsMw).toBe(800);
    expect(power.storageChargingMw).toBe(2_000);
    expect(power.transfersMw).toBe(1_200);
    expect(power.demandMw).toBe(30_200);
    expect(power.demandMw).toBe(
      (power.generationMw ?? 0) +
        (power.importsMw ?? 0) -
        (power.exportsMw ?? 0) -
        (power.storageChargingMw ?? 0)
    );
    expect(power.terms.map((term) => term.label)).toEqual([
      "Generation",
      "Imports",
      "Exports",
      "Storage charging",
      "Demand",
    ]);
    expect(power.showEquals).toBe(true);
    expect(headlineBalanceResidualMw(power)).toBe(0);
    expect(headlineBalanceHolds(power)).toBe(true);
  });

  it("is the only demand figure wired into the page", () => {
    const dashboard = readFileSync(resolve(import.meta.dirname, "../components/dashboard.tsx"), "utf8");
    const desk = readFileSync(resolve(import.meta.dirname, "../components/generation-desk.tsx"), "utf8");
    const equation = readFileSync(resolve(import.meta.dirname, "../components/equation-row.tsx"), "utf8");

    const og = readFileSync(resolve(import.meta.dirname, "./og/model.ts"), "utf8");

    expect(dashboard).toContain("getDisplayedPower");
    expect(desk).toContain("getDisplayedPower");
    expect(desk).toContain("power.demandMw");
    expect(equation).toContain("data-stat={term.id}");
    expect(equation).toContain("data-balanced");
    expect(equation).toContain("power.terms");
    expect(og).toContain("getDisplayedPower");
    expect(dashboard).not.toContain("facts.demand.value");
    expect(desk).not.toContain("facts.demand.value");
  });
});
