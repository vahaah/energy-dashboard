import { describe, expect, it } from "vitest";
import type { EnergySnapshot, Generation5min } from "@/lib/types";
import {
  buildGenerationStackSeries,
  buildRangeSummary,
  mapGenerationFuelToStackKey,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";

function makeSnapshot(
  overrides: Partial<EnergySnapshot> = {}
): EnergySnapshot {
  return {
    timestamp: "2026-03-18 00:00:00",
    carbon_intensity: 100,
    carbon_forecast: 110,
    carbon_index: "low",
    demand_mw: 20000,
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
    ...overrides,
  };
}

describe("dashboard model", () => {
  it("normalizes fuels so interconnectors are case-insensitive", () => {
    expect(normalizeFuelType(" INTFR ")).toBe("intfr");
    expect(normalizeFuelType("InTNeD")).toBe("intned");
  });

  it("splits the latest generation rows into sources vs interconnectors", () => {
    const rows: Generation5min[] = [
      {
        timestamp: "2026-03-18 09:55:00",
        fuel_type: "ccgt",
        generation_mw: 17000,
        source: "fuelinst",
      },
      {
        timestamp: "2026-03-18 10:00:00",
        fuel_type: "ccgt",
        generation_mw: 18000,
        source: "fuelinst",
      },
      {
        timestamp: "2026-03-18 10:00:00",
        fuel_type: "INTFR",
        generation_mw: 600,
        source: "fuelinst",
      },
      {
        timestamp: "2026-03-18 10:00:00",
        fuel_type: "intned",
        generation_mw: -300,
        source: "fuelinst",
      },
      {
        timestamp: "2026-03-18 10:00:00",
        fuel_type: "embedded_wind",
        generation_mw: 900,
        source: "neso",
      },
    ];

    expect(splitLatestGenerationRows(rows)).toEqual({
      latestTimestamp: "2026-03-18 10:00:00",
      sources: [
        {
          timestamp: "2026-03-18 10:00:00",
          fuel_type: "ccgt",
          generation_mw: 18000,
          source: "fuelinst",
        },
        {
          timestamp: "2026-03-18 10:00:00",
          fuel_type: "embedded_wind",
          generation_mw: 900,
          source: "neso",
        },
      ],
      interconnectors: [
        {
          timestamp: "2026-03-18 10:00:00",
          fuel_type: "INTFR",
          generation_mw: 600,
          source: "fuelinst",
        },
        {
          timestamp: "2026-03-18 10:00:00",
          fuel_type: "intned",
          generation_mw: -300,
          source: "fuelinst",
        },
      ],
      totalGenerationMw: 18900,
      netTransfersMw: 300,
    });
  });

  it("maps generation fuels into stable stack keys", () => {
    expect(mapGenerationFuelToStackKey("ccgt")).toBe("gas");
    expect(mapGenerationFuelToStackKey("OCGT")).toBe("gas");
    expect(mapGenerationFuelToStackKey("npshyd")).toBe("hydro");
    expect(mapGenerationFuelToStackKey("ps")).toBe("hydro");
    expect(mapGenerationFuelToStackKey("oil")).toBe("other");
    expect(mapGenerationFuelToStackKey("embedded_wind")).toBe("embedded_wind");
  });

  it("builds aligned stack series from mis-timed generation rows", () => {
    const series = buildGenerationStackSeries(
      [
        {
          timestamp: "2026-03-18 10:00:00",
          fuel_type: "ccgt",
          generation_mw: 60,
          source: "fuelinst",
        },
        {
          timestamp: "2026-03-18 10:04:00",
          fuel_type: "embedded_wind",
          generation_mw: 40,
          source: "neso",
        },
        {
          timestamp: "2026-03-18 10:31:00",
          fuel_type: "ccgt",
          generation_mw: 30,
          source: "fuelinst",
        },
        {
          timestamp: "2026-03-18 10:34:00",
          fuel_type: "embedded_wind",
          generation_mw: 70,
          source: "neso",
        },
        {
          timestamp: "2026-03-18 10:35:00",
          fuel_type: "INTFR",
          generation_mw: 10,
          source: "fuelinst",
        },
      ],
      "24h"
    );

    expect(series).toHaveLength(2);
    expect(series[0]?.gas).toBeCloseTo(60, 5);
    expect(series[0]?.embedded_wind).toBeCloseTo(40, 5);
    expect(series[0]?.imports).toBe(0);
    expect(series[1]?.gas).toBeCloseTo(27.27, 2);
    expect(series[1]?.embedded_wind).toBeCloseTo(63.64, 2);
    expect(series[1]?.imports).toBeCloseTo(9.09, 2);
  });

  it("builds selected-range averages and extrema for insight cards", () => {
    const summary = buildRangeSummary([
      makeSnapshot({
        timestamp: "2026-03-18 08:00:00",
        carbon_intensity: 120,
        demand_mw: 21000,
        price_gbp_mwh: 60,
      }),
      makeSnapshot({
        timestamp: "2026-03-18 09:00:00",
        carbon_intensity: 90,
        demand_mw: 25000,
        price_gbp_mwh: 45,
      }),
      makeSnapshot({
        timestamp: "2026-03-18 10:00:00",
        carbon_intensity: 110,
        demand_mw: 23000,
        price_gbp_mwh: 75,
      }),
    ]);

    expect(summary).toEqual({
      carbon: { latest: 110, average: 107, min: 90, max: 120, deltaFromAverage: 3 },
      demand: {
        latest: 23000,
        average: 23000,
        min: 21000,
        max: 25000,
        deltaFromAverage: 0,
      },
      price: { latest: 75, average: 60, min: 45, max: 75, deltaFromAverage: 15 },
    });
  });
});
