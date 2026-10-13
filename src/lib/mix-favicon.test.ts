import { describe, expect, it } from "vitest";
import { mixSegmentsFromSnapshot, renderMixFaviconSvg } from "@/lib/mix-favicon";
import type { EnergySnapshot } from "@/lib/types";

function snapshot(overrides: Partial<EnergySnapshot> = {}): EnergySnapshot {
  return {
    timestamp: "2026-10-09 16:00:00",
    carbon_intensity: 48,
    carbon_forecast: 48,
    carbon_index: "low",
    demand_mw: 30000,
    price_gbp_mwh: 70,
    price_mid_gbp_mwh: 68,
    gen_gas_pct: 40,
    gen_coal_pct: 0,
    gen_nuclear_pct: 15,
    gen_wind_pct: 35,
    gen_solar_pct: 0,
    gen_hydro_pct: 5,
    gen_biomass_pct: 5,
    gen_imports_pct: 0,
    gen_other_pct: 0,
    gen_gas_mw: 8000,
    gen_coal_mw: 0,
    gen_nuclear_mw: 3000,
    gen_wind_mw: 7000,
    gen_solar_mw: 0,
    gen_hydro_mw: 400,
    gen_biomass_mw: 600,
    gen_other_mw: 0,
    ...overrides,
  };
}

describe("mix favicon", () => {
  it("builds ring segments from the latest snapshot mix and skips zeros", () => {
    expect(mixSegmentsFromSnapshot(snapshot()).map((segment) => segment.fuel)).toEqual([
      "gas",
      "nuclear",
      "wind",
      "hydro",
      "biomass",
    ]);
  });

  it("renders an SVG mix ring without querying Tinybird", () => {
    const svg = renderMixFaviconSvg(snapshot());
    expect(svg).toContain("<svg");
    expect(svg).toContain("Current GB generation mix");
    expect(svg).toContain("#f97316");
    expect(svg).not.toContain("tinybird");
  });

  it("draws a full ring when only one fuel percentage is positive", () => {
    const svg = renderMixFaviconSvg(
      snapshot({
        gen_gas_pct: 100,
        gen_coal_pct: null,
        gen_nuclear_pct: null,
        gen_wind_pct: null,
        gen_solar_pct: null,
        gen_hydro_pct: null,
        gen_biomass_pct: null,
        gen_imports_pct: null,
        gen_other_pct: null,
      })
    );

    expect(svg).toContain('fill="#f97316"');
    const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      const outer = path.match(/A 15 15 0 \d \d ([\d.]+) ([\d.]+)/);
      expect(outer).not.toBeNull();
      expect(path.startsWith(`M ${outer?.[1]} ${outer?.[2]}`)).toBe(false);
    }
  });
});
