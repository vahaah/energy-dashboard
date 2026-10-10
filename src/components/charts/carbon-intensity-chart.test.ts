import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCarbonSeries } from "@/components/charts/carbon-intensity-chart";
import type { EnergySnapshot } from "@/lib/types";

function snapshot(timestamp: string, carbon: number): EnergySnapshot {
  return {
    timestamp,
    carbon_intensity: carbon,
    carbon_forecast: carbon,
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
  };
}

describe("mergeCarbonSeries", () => {
  it("keeps actuals and extends a dashed forecast after them", () => {
    const series = mergeCarbonSeries(
      [snapshot("2026-10-10 11:00:00", 80), snapshot("2026-10-10 11:30:00", 76)],
      [
        { time: "2026-10-10 11:30:00", value: 74 },
        { time: "2026-10-10 12:00:00", value: 45 },
      ]
    );

    expect(series).toEqual([
      { time: "2026-10-10 11:00:00", actual: 80, forecast: null },
      { time: "2026-10-10 11:30:00", actual: 76, forecast: 74 },
      { time: "2026-10-10 12:00:00", actual: null, forecast: 45 },
    ]);
  });

  it("keeps the g unit above the top y-axis tick", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "./carbon-intensity-chart.tsx"),
      "utf8"
    );
    expect(source).toContain("chartYAxisUnitLabel");
    expect(source).toContain("top: 24");
    expect(source).not.toContain("offset: 8");
  });
});
