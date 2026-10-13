import { describe, expect, it } from "vitest";
import { parseUtcDateTime } from "@/lib/london-time";
import type { DashboardPayload } from "@/lib/dashboard-payload-model";
import { emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";
import type { EnergySnapshot, Generation5min } from "@/lib/types";
import {
  buildTodayPageModel,
  energySharesFromSnapshots,
  interconnectorFlows,
  priceExtremes,
  snapshotsForLondonDate,
  todayCitePlainText,
  todayFaqs,
} from "@/lib/today-page";

function snapshot(overrides: Partial<EnergySnapshot> = {}): EnergySnapshot {
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
    gen_gas_mw: 6000,
    gen_coal_mw: 0,
    gen_nuclear_mw: 3000,
    gen_wind_mw: 16_000,
    gen_solar_mw: 1000,
    gen_hydro_mw: 1000,
    gen_biomass_mw: 1000,
    gen_other_mw: 0,
    ...overrides,
  };
}

function generation(
  timestamp: string,
  fuelType: string,
  generationMw: number
): Generation5min {
  return { timestamp, fuel_type: fuelType, generation_mw: generationMw, source: "fuelinst" };
}

function payload(input: {
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
}): DashboardPayload {
  const now = new Date("2026-10-10T12:00:00.000Z");
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
      stamp: "Data as of test",
      headerStamp: "Data as of test",
      carbon: {
        value: 148,
        index: "moderate",
        unit: "gCO₂/kWh",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Carbon Intensity API",
        definition: "test",
      },
      demand: {
        value: 32_400,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      price: {
        value: 45.2,
        unit: "£/MWh",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      systemPrice: {
        value: 67,
        unit: "£/MWh",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      generationMw: {
        value: 28_000,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      netImportsMw: {
        value: 1500,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      pumpedStorageMw: {
        value: 0,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      shares: [],
      generationRows: input.generation,
      mixSnapshot: input.snapshots[0] ?? null,
      referenceTimestamp: "2026-10-10 11:00:00",
    },
    snapshots: input.snapshots,
    headlineSnapshots: input.snapshots,
    generationHistory: input.generation,
    headlineGeneration: input.generation,
    prices: [],
    records: emptyRecordsWithDocumentedCoal(now),
    historicView: null,
    transitionView: null,
    lookAhead: null,
  };
}

describe("today page model", () => {
  const daySnapshots = [
    snapshot(),
    snapshot({
      timestamp: "2026-10-10 11:30:00",
      price_mid_gbp_mwh: 80,
      gen_gas_mw: 8000,
      gen_wind_mw: 12_000,
    }),
  ];
  const weekSnapshots = [
    snapshot({ timestamp: "2026-10-09 12:00:00", carbon_intensity: 200, demand_mw: 36_000 }),
    ...daySnapshots,
  ];
  const generationRows = [
    generation("2026-10-10 11:30:00", "wind", 12_000),
    generation("2026-10-10 11:30:00", "gas", 8000),
    generation("2026-10-10 11:30:00", "INTFR", 1500),
  ];

  it("builds a citable today sentence from cached snapshots", () => {
    const model = buildTodayPageModel({
      day: payload({ snapshots: daySnapshots, generation: generationRows }),
      week: payload({ snapshots: weekSnapshots, generation: generationRows }),
      now: new Date("2026-10-10T12:00:00.000Z"),
    });
    expect(model.kind).toBe("numbers");
    const text = todayCitePlainText(model);
    expect(text).toContain("So far today");
    expect(text).toContain("wind supplied");
    expect(text).toContain("gCO₂/kWh");
    expect(text).toContain("Elexon BMRS, NESO");
    expect(text).not.toMatch(/\blive\b/i);
    expect(model.dateModified).toBe("2026-10-10T11:30:00.000Z");
    expect(model.untilDatetime).toBe("2026-10-10T12:30:00+01:00");
    expect(parseUtcDateTime(model.untilDatetime ?? "").toISOString()).toBe(model.dateModified);
    expect(model.cheapest?.value).toBe(45.2);
    expect(model.dearest?.value).toBe(80);
    expect(model.comparison.yesterday.carbon).toBe(200);
    expect(model.interconnectors[0]?.country).toBeTruthy();
  });

  it("energy-weights today's gas share from half-hours", () => {
    const shares = energySharesFromSnapshots(daySnapshots);
    expect(shares.gasPct).toBeGreaterThan(20);
    expect(shares.gasGwh).toBeCloseTo((6000 + 8000) * 0.5 / 1000, 5);
  });

  it("counts generating storage in the daily share and leaves imports out", () => {
    const domesticOnly = energySharesFromSnapshots([snapshot()]);
    const withImports = energySharesFromSnapshots([
      snapshot({
        gen_imports_pct: 10,
      }),
    ]);
    const withStorage = energySharesFromSnapshots([
      snapshot({
        gen_pumped_mw: 2000,
        gen_battery_mw: 500,
      }),
    ]);
    expect(withImports.windPct).toBeCloseTo(domesticOnly.windPct ?? 0, 5);
    expect(withStorage.windPct ?? 0).toBeLessThan(domesticOnly.windPct ?? 0);
    expect(withStorage.gasPct ?? 0).toBeLessThan(domesticOnly.gasPct ?? 0);
  });

  it("uses market index only for extrema and skips imbalance-only gaps", () => {
    const extremes = priceExtremes([
      snapshot({ price_mid_gbp_mwh: 40, price_gbp_mwh: 12 }),
      snapshot({
        timestamp: "2026-10-10 11:30:00",
        price_mid_gbp_mwh: null,
        price_gbp_mwh: 200,
      }),
      snapshot({
        timestamp: "2026-10-10 12:00:00",
        price_mid_gbp_mwh: 55,
        price_gbp_mwh: 9,
      }),
    ]);
    expect(extremes.cheapest?.value).toBe(40);
    expect(extremes.dearest?.value).toBe(55);
  });

  it("labels export flows with the absolute magnitude", () => {
    const flows = interconnectorFlows([generation("2026-10-10 11:30:00", "INTFR", -1200)]);
    expect(flows[0]?.mw).toBe(-1200);
    expect(flows[0]?.gwLabel).toBe("1.2");
  });

  it("fills the 25-hour London date from the week payload when the rolling day window dropped early periods", () => {
    const now = new Date("2026-10-25T23:30:00.000Z");
    const early = snapshot({
      timestamp: "2026-10-24 23:00:00",
      price_mid_gbp_mwh: 12,
      gen_wind_mw: 20_000,
      gen_gas_mw: 1000,
    });
    const late = snapshot({
      timestamp: "2026-10-25 23:00:00",
      price_mid_gbp_mwh: 88,
      gen_wind_mw: 8000,
      gen_gas_mw: 4000,
    });
    const covered = snapshotsForLondonDate([late], [early, late], "2026-10-25");
    expect(covered.map((row) => row.timestamp)).toEqual([
      "2026-10-24 23:00:00",
      "2026-10-25 23:00:00",
    ]);
    const model = buildTodayPageModel({
      day: payload({ snapshots: [late], generation: generationRows }),
      week: payload({ snapshots: [early, late], generation: generationRows }),
      now,
    });
    expect(model.londonDate).toBe("2026-10-25");
    expect(model.cheapest?.value).toBe(12);
    expect(model.dearest?.value).toBe(88);
    expect(model.priceAverage).toBe(50);
  });

  it("answers the visible FAQ from the same model", () => {
    const model = buildTodayPageModel({
      day: payload({ snapshots: daySnapshots, generation: generationRows }),
      week: payload({ snapshots: weekSnapshots, generation: generationRows }),
      now: new Date("2026-10-10T12:00:00.000Z"),
    });
    const questions = todayFaqs(model).map((faq) => faq.question);
    expect(questions).toEqual([
      "How much of Britain's electricity is wind right now?",
      "How much came from gas today?",
      "Is Britain importing electricity today?",
      "How clean is the grid today?",
      "What's the wholesale electricity price today?",
    ]);
  });
});
