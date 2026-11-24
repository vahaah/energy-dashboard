import { describe, expect, it } from "vitest";
import { emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";
import { buildLlmsTxt } from "@/lib/llms-txt";
import type { DashboardPayload } from "@/lib/dashboard-payload-model";
import { homepageCiteFromPayload } from "@/lib/homepage-briefing";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

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
        value: 23_000,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:00:00.000Z",
        source: "Elexon BMRS",
        definition: "test",
      },
      netImportsMw: {
        value: 0,
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

describe("llms.txt", () => {
  it("is plain text with pages, API and no banned words", () => {
    const text = buildLlmsTxt(payload());
    const cite = homepageCiteFromPayload(payload());
    expect(cite.kind).toBe("numbers");
    expect(text).toContain("# Grid");
    expect(text).toContain("https://grid.vahaah.com/today");
    expect(text).toContain("https://grid.vahaah.com/api");
    expect(text).toContain("get_price_cap");
    expect(text).toContain("document.modelContext");
    expect(text).toContain("gCO2/kWh");
    expect(text.replace(/PV Live/g, "")).not.toMatch(/\blive\b/i);
    expect(text).not.toMatch(/real-time/i);
    expect(text).not.toMatch(/open source/i);
    expect(text).not.toMatch(/\bTTF\b/);
  });
});
