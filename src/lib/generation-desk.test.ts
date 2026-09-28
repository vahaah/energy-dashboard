import { describe, expect, it } from "vitest";
import {
  buildDemandBalanceSeries,
  demandPointsFromSnapshots,
  generationSharesFromRows,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

function generation(
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

function snapshot(
  timestamp: string,
  overrides: Partial<EnergySnapshot> = {}
): EnergySnapshot {
  return {
    timestamp,
    carbon_intensity: 80,
    carbon_forecast: 80,
    carbon_index: "low",
    demand_mw: 24000,
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

const LIVE_AHEAD_EMBEDDED_FIXTURE: Generation5min[] = [
  generation("2026-09-28 03:00:00", "biomass", 2948),
  generation("2026-09-28 03:00:00", "ccgt", 7563),
  generation("2026-09-28 03:00:00", "ocgt", 0),
  generation("2026-09-28 03:00:00", "coal", 0),
  generation("2026-09-28 03:00:00", "nuclear", 4015),
  generation("2026-09-28 03:00:00", "wind", 3746),
  generation("2026-09-28 03:00:00", "npshyd", 571),
  generation("2026-09-28 03:00:00", "ps", 231),
  generation("2026-09-28 03:00:00", "other", 224),
  generation("2026-09-28 03:00:00", "intelec", 250),
  generation("2026-09-28 03:00:00", "intfr", 396),
  generation("2026-09-28 03:00:00", "intifa2", 76),
  generation("2026-09-28 03:00:00", "intnsl", 1400),
  generation("2026-09-28 03:00:00", "intvkl", 274),
  generation("2026-09-28 03:00:00", "intew", -47),
  generation("2026-09-28 03:00:00", "intgrnl", -514),
  generation("2026-09-28 03:00:00", "intirl", -381),
  generation("2026-09-28 03:00:00", "intned", -111),
  generation("2026-09-28 03:00:00", "intnem", -196),
  generation("2026-09-28 03:00:00", "embedded_wind", 917, "neso"),
  generation("2026-09-28 03:00:00", "embedded_solar", 0, "pvlive"),
  generation("2026-09-28 05:00:00", "embedded_wind", 817, "neso"),
  generation("2026-09-28 05:00:00", "embedded_solar", 0, "pvlive"),
];

describe("latest generation snapshot alignment", () => {
  it("reproduces the live By source bug: max timestamp is embedded-only", () => {
    const newest = LIVE_AHEAD_EMBEDDED_FIXTURE.filter(
      (row) => row.timestamp === "2026-09-28 05:00:00"
    );
    const naiveShares = generationSharesFromRows(newest);

    expect(newest.map((row) => row.fuel_type).sort()).toEqual([
      "embedded_solar",
      "embedded_wind",
    ]);
    expect(naiveShares).toEqual([
      { fuel: "embedded_wind", mw: 817, sharePct: 100 },
    ]);
  });

  it("builds one fuelinst-anchored snapshot for the donut, table, and headline", () => {
    const split = splitLatestGenerationRows(LIVE_AHEAD_EMBEDDED_FIXTURE);
    const snapshotRows = [...split.sources, ...split.interconnectors];
    const shares = generationSharesFromRows(snapshotRows);

    expect(split.latestTimestamp).toBe("2026-09-28 03:00:00");
    expect(split.totalGenerationMw).toBe(20215);
    expect(split.netTransfersMw).toBe(1147);
    expect(shares.map((share) => share.fuel).sort()).toEqual([
      "biomass",
      "embedded_wind",
      "gas",
      "hydro",
      "imports",
      "nuclear",
      "other",
      "wind",
    ]);
    expect(shares.find((share) => share.fuel === "gas")?.mw).toBe(7563);
    expect(shares.find((share) => share.fuel === "hydro")?.mw).toBe(802);
    expect(shares.find((share) => share.fuel === "imports")?.mw).toBe(2396);
    expect(shares.find((share) => share.fuel === "embedded_wind")?.mw).toBe(917);
    expect(shares.reduce((sum, share) => sum + share.sharePct, 0)).toBeCloseTo(100, 5);
  });
});

describe("domestic generation series", () => {
  const june28Fuels: Generation5min[] = [
    generation("2026-06-28 00:00:00", "ccgt", 10000),
    generation("2026-06-28 00:00:00", "ocgt", 200),
    generation("2026-06-28 00:00:00", "wind", 4000),
    generation("2026-06-28 00:00:00", "nuclear", 3500),
    generation("2026-06-28 00:00:00", "biomass", 1500),
    generation("2026-06-28 00:00:00", "npshyd", 300),
    generation("2026-06-28 00:00:00", "ps", -250),
    generation("2026-06-28 00:00:00", "embedded_wind", 1800, "neso"),
    generation("2026-06-28 00:00:00", "embedded_solar", 4200, "pvlive"),
    generation("2026-06-28 00:00:00", "INTFR", 2000),
    generation("2026-06-28 00:00:00", "intned", -600),
  ];

  const june29MissingEmbeddedWind: Generation5min[] = [
    generation("2026-06-29 00:00:00", "ccgt", 9800),
    generation("2026-06-29 00:00:00", "ocgt", 150),
    generation("2026-06-29 00:00:00", "wind", 4200),
    generation("2026-06-29 00:00:00", "nuclear", 3500),
    generation("2026-06-29 00:00:00", "biomass", 1400),
    generation("2026-06-29 00:00:00", "npshyd", 280),
    generation("2026-06-29 00:00:00", "ps", 120),
    generation("2026-06-29 00:00:00", "embedded_solar", 4100, "pvlive"),
    generation("2026-06-29 00:00:00", "INTFR", 1800),
  ];

  const june30FiveMinuteTrap: Generation5min[] = [
    generation("2026-06-30 00:00:00", "ccgt", 11000),
    generation("2026-06-30 00:05:00", "ccgt", 11000),
    generation("2026-06-30 00:10:00", "ccgt", 11000),
    generation("2026-06-30 00:00:00", "wind", 3000),
    generation("2026-06-30 00:05:00", "wind", 3000),
    generation("2026-06-30 00:10:00", "wind", 3000),
    generation("2026-06-30 00:00:00", "nuclear", 3400),
    generation("2026-06-30 00:00:00", "biomass", 1600),
    generation("2026-06-30 00:00:00", "embedded_wind", 1700, "neso"),
    generation("2026-06-30 00:00:00", "embedded_solar", 3900, "pvlive"),
    generation("2026-06-30 00:00:00", "INTFR", 2200),
  ];

  const inflatedSnapshots: EnergySnapshot[] = [
    snapshot("2026-06-28 00:00:00", {
      demand_mw: 25000,
      gen_gas_mw: 23000,
      gen_wind_mw: 15000,
      gen_solar_mw: 8000,
      gen_nuclear_mw: 3800,
      gen_biomass_mw: 2000,
      gen_hydro_mw: 800,
      gen_other_mw: 1200,
      gen_coal_mw: 0,
    }),
    snapshot("2026-06-29 00:00:00", {
      demand_mw: 24500,
      gen_gas_mw: 4000,
      gen_wind_mw: 800,
      gen_solar_mw: 60,
      gen_nuclear_mw: 0,
      gen_biomass_mw: 0,
      gen_hydro_mw: 0,
      gen_other_mw: 0,
      gen_coal_mw: 0,
    }),
    snapshot("2026-06-30 00:00:00", {
      demand_mw: 25500,
      gen_gas_mw: 22000,
      gen_wind_mw: 14000,
      gen_solar_mw: 9000,
      gen_nuclear_mw: 4000,
      gen_biomass_mw: 1800,
      gen_hydro_mw: 700,
      gen_other_mw: 1100,
      gen_coal_mw: 0,
    }),
  ];

  it("does not inherit the 5–50 GW snapshot-mw swings for June 2026", () => {
    const series = buildDemandBalanceSeries(
      inflatedSnapshots,
      [...june28Fuels, ...june29MissingEmbeddedWind, ...june30FiveMinuteTrap],
      "1y"
    );

    const byDay = new Map(series.map((point) => [point.time.slice(0, 10), point]));
    const june28 = 10000 + 200 + 4000 + 3500 + 1500 + 300 + 1800 + 4200;
    const june29 = 9800 + 150 + 4200 + 3500 + 1400 + 280 + 120 + 1800 + 4100;
    const june30 = 11000 + 3000 + 3400 + 1600 + 1700 + 3900;

    expect(byDay.get("2026-06-28")?.domesticGenerationMw).toBe(june28);
    expect(byDay.get("2026-06-29")?.domesticGenerationMw).toBe(june29);
    expect(byDay.get("2026-06-30")?.domesticGenerationMw).toBe(june30);

    for (const point of series) {
      expect(point.domesticGenerationMw).toBeGreaterThan(18000);
      expect(point.domesticGenerationMw).toBeLessThan(32000);
    }

    expect(byDay.get("2026-06-28")?.domesticGenerationMw).not.toBe(
      23000 + 15000 + 8000 + 3800 + 2000 + 800 + 1200
    );
    expect(byDay.get("2026-06-29")?.domesticGenerationMw).not.toBe(4860);
  });

  it("carries embedded wind forward instead of stepping down on a missing day", () => {
    const withoutCarry = 9800 + 150 + 4200 + 3500 + 1400 + 280 + 120 + 4100;
    const withCarry = withoutCarry + 1800;
    const series = buildDemandBalanceSeries(
      inflatedSnapshots,
      [...june28Fuels, ...june29MissingEmbeddedWind],
      "1y"
    );
    const june29 = series.find((point) => point.time.startsWith("2026-06-29"));

    expect(june29?.domesticGenerationMw).toBe(withCarry);
    expect(june29?.domesticGenerationMw).not.toBe(withoutCarry);
  });

  it("averages repeated 5-min rows in a daily bucket instead of summing them", () => {
    const summedTrap = 11000 * 3 + 3000 * 3 + 3400 + 1600 + 1700 + 3900;
    const series = buildDemandBalanceSeries(inflatedSnapshots, june30FiveMinuteTrap, "1y");
    const june30 = series.find((point) => point.time.startsWith("2026-06-30"));

    expect(june30?.domesticGenerationMw).toBe(11000 + 3000 + 3400 + 1600 + 1700 + 3900);
    expect(june30?.domesticGenerationMw).not.toBe(summedTrap);
  });

  it("excludes interconnectors and negative pumped storage from domestic generation", () => {
    const series = buildDemandBalanceSeries(inflatedSnapshots, june28Fuels, "1y");
    const june28 = series.find((point) => point.time.startsWith("2026-06-28"));

    expect(june28?.domesticGenerationMw).toBe(25500);
    expect(june28?.domesticGenerationMw).not.toBe(25500 + 2000 - 600);
    expect(june28?.domesticGenerationMw).not.toBe(25500 - 250);
  });
});

describe("demand series", () => {
  it("keeps missing demand as a gap and does not coerce it to zero", () => {
    const points = demandPointsFromSnapshots([
      snapshot("2026-06-28 00:00:00", { demand_mw: 25000 }),
      snapshot("2026-06-29 00:00:00", { demand_mw: null }),
      snapshot("2026-06-30 00:00:00", { demand_mw: 0 }),
    ]);

    expect(points.map((point) => point.demand)).toEqual([25000, null, 0]);
  });

  it("joins demand onto the same daily buckets as domestic generation", () => {
    const series = buildDemandBalanceSeries(
      [
        snapshot("2026-06-28 00:00:00", { demand_mw: 25000 }),
        snapshot("2026-06-29 00:00:00", { demand_mw: null }),
        snapshot("2026-06-30 00:00:00", { demand_mw: 25500 }),
      ],
      [
        generation("2026-06-28 00:00:00", "wind", 20000),
        generation("2026-06-30 00:00:00", "wind", 21000),
      ],
      "1y"
    );

    expect(series.find((point) => point.time.startsWith("2026-06-28"))).toEqual({
      time: "2026-06-28 00:00:00",
      demandMw: 25000,
      domesticGenerationMw: 20000,
    });
    expect(series.find((point) => point.time.startsWith("2026-06-29"))?.demandMw).toBeNull();
    expect(series.find((point) => point.time.startsWith("2026-06-30"))?.demandMw).toBe(25500);
  });
});
