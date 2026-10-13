import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EquationRow } from "@/components/equation-row";
import { getDisplayedPower, headlineBalanceHolds } from "@/lib/displayed-demand";
import { formatHeadlineGw, type LatestFacts } from "@/lib/facts";
import { buildSettlementBalance, headlineTermsClose } from "@/lib/headline-balance";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

const SP18_TIMES = [
  "2026-10-13 07:30:00",
  "2026-10-13 07:35:00",
  "2026-10-13 07:40:00",
  "2026-10-13 07:45:00",
  "2026-10-13 07:50:00",
  "2026-10-13 07:55:00",
] as const;

const SP18_FUELS: Record<string, readonly number[]> = {
  biomass: [2447, 2443, 2446, 2424, 2410, 2412],
  ccgt: [5884, 5845, 5827, 5836, 5989, 6245],
  coal: [0, 0, 0, 0, 0, 0],
  intelec: [0, 0, 0, 0, 0, 0],
  intew: [-205, -180, -155, -130, -104, -79],
  intfr: [-635, -635, -635, -636, -635, -572],
  intgrnl: [-514, -514, -514, -515, -514, -514],
  intifa2: [-911, -911, -911, -911, -911, -850],
  intirl: [-451, -451, -451, -451, -451, -438],
  intned: [-214, -214, -214, -214, -214, -214],
  intnem: [-468, -468, -468, -468, -468, -474],
  intnsl: [1029, 1029, 1029, 1029, 1022, 1009],
  intvkl: [551, 551, 551, 551, 551, 520],
  npshyd: [541, 544, 547, 547, 547, 546],
  nuclear: [4047, 4050, 4057, 4052, 4050, 4050],
  ocgt: [0, 0, 0, 0, 0, 0],
  oil: [0, 0, 0, 0, 0, 0],
  other: [2273, 2141, 2084, 2272, 2112, 1698],
  ps: [63, 55, 60, 128, 365, 373],
  wind: [14289, 14321, 14374, 14439, 14407, 14465],
};

function row(
  timestamp: string,
  fuelType: string,
  generationMw: number,
  source = "fuelinst"
): Generation5min {
  return { timestamp, fuel_type: fuelType, generation_mw: generationMw, source };
}

function sp18Rows(): Generation5min[] {
  const rows: Generation5min[] = [];
  for (const [fuel, samples] of Object.entries(SP18_FUELS)) {
    samples.forEach((mw, index) => {
      const timestamp = SP18_TIMES[index];
      if (timestamp) {
        rows.push(row(timestamp, fuel, mw));
      }
    });
  }
  rows.push(row("2026-10-13 07:30:00", "embedded_wind", 3169, "neso"));
  rows.push(row("2026-10-13 07:30:00", "embedded_solar", 386.737, "pvlive"));
  // Next settlement period. The old headline carried this wind onto SP18.
  rows.push(row("2026-10-13 08:00:00", "embedded_wind", 3160, "neso"));
  rows.push(row("2026-10-13 08:15:00", "ccgt", 6237));
  rows.push(row("2026-10-13 08:15:00", "intfr", -9999));
  return rows;
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

function facts(generationRows: Generation5min[], demandMw = 31_223): LatestFacts {
  return {
    empty: false,
    emptyState: null,
    coverageStart: "2025-09-28",
    requestedDate: "2026-10-13",
    isHistorical: false,
    isStale: false,
    stamp: null,
    headerStamp: "Data as of test",
    carbon: { ...fact(80, "2026-10-13T07:30:00.000Z", "Carbon Intensity API"), index: "low" },
    demand: fact(demandMw, "2026-10-13T07:30:00.000Z", "Elexon BMRS"),
    price: fact(50, "2026-10-13T07:30:00.000Z", "Elexon BMRS"),
    systemPrice: fact(50, "2026-10-13T07:30:00.000Z", "Elexon BMRS"),
    generationMw: fact(33_336, "2026-10-13T07:55:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
    netImportsMw: fact(-1612, "2026-10-13T07:55:00.000Z", "Elexon BMRS"),
    pumpedStorageMw: fact(373, "2026-10-13T07:55:00.000Z", "Elexon BMRS"),
    shares: [],
    generationRows,
    mixSnapshot: null,
    referenceTimestamp: "2026-10-13T07:55:00.000Z",
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
    gen_gas_pct: null,
    gen_coal_pct: null,
    gen_nuclear_pct: null,
    gen_wind_pct: null,
    gen_solar_pct: null,
    gen_hydro_pct: null,
    gen_biomass_pct: null,
    gen_imports_pct: null,
    gen_other_pct: null,
    gen_gas_mw: null,
    gen_coal_mw: null,
    gen_nuclear_mw: null,
    gen_wind_mw: null,
    gen_solar_mw: null,
    gen_hydro_mw: null,
    gen_biomass_mw: null,
    gen_other_mw: null,
  };
}

function identity(power: {
  demandMw: number | null;
  generationMw: number | null;
  importsMw: number | null;
  exportsMw: number | null;
  storageChargingMw: number | null;
}): number {
  return (
    (power.demandMw ?? 0) -
    ((power.generationMw ?? 0) +
      (power.importsMw ?? 0) -
      (power.exportsMw ?? 0) -
      (power.storageChargingMw ?? 0))
  );
}

describe("13 Oct 2026 08:30–09:00 BST headline balance", () => {
  const power = getDisplayedPower(facts(sp18Rows()), [snapshot("2026-10-13 07:30:00", 31_223)]);

  it("lists every fuel on the half-hour average, not the last 5-minute tick", () => {
    const balance = buildSettlementBalance(sp18Rows(), "2026-10-13T07:30:00.000Z");
    const mw = Object.fromEntries(balance.fuels.map((fuel) => [fuel.fuel, fuel.mw]));

    expect(mw.wind).toBeCloseTo(14_382.5, 3);
    expect(mw.ccgt).toBeCloseTo(5_937.667, 3);
    expect(mw.nuclear).toBeCloseTo(4_051, 3);
    expect(mw.biomass).toBeCloseTo(2_430.333, 3);
    expect(mw.other).toBeCloseTo(2_096.667, 3);
    expect(mw.npshyd).toBeCloseTo(545.333, 3);
    expect(mw.ps).toBeCloseTo(174, 3);
    expect(mw.embedded_wind).toBe(3169);
    expect(mw.embedded_solar).toBeCloseTo(386.737, 3);
    expect(mw.intnsl).toBeCloseTo(1_024.5, 3);
    expect(mw.intvkl).toBeCloseTo(545.833, 3);
    expect(mw.intelec).toBe(0);
    expect(mw.intew).toBeCloseTo(-142.167, 3);
    expect(mw.intfr).toBeCloseTo(-624.667, 3);
    expect(mw.intgrnl).toBeCloseTo(-514.167, 3);
    expect(mw.intifa2).toBeCloseTo(-900.833, 3);
    expect(mw.intirl).toBeCloseTo(-448.833, 3);
    expect(mw.intned).toBe(-214);
    expect(mw.intnem).toBe(-469);
    expect(mw.embedded_wind).not.toBe(3160);
    expect(balance.fuels.find((fuel) => fuel.fuel === "intfr")?.samples).toBe(6);
  });

  it("closes demand = generation + imports − exports − storage charging", () => {
    expect(power.balanceClosed).toBe(true);
    expect(power.generationStartUtc).toBe("2026-10-13T07:30:00.000Z");
    expect(power.demandStartUtc).toBe(power.generationStartUtc);
    expect(power.transfersStartUtc).toBe(power.generationStartUtc);
    expect(power.generationMw).toBeCloseTo(33_173.237, 2);
    expect(power.importsMw).toBeCloseTo(1_570.333, 2);
    expect(power.exportsMw).toBeCloseTo(3_313.667, 2);
    expect(power.storageChargingMw).toBe(0);
    expect(power.transfersMw).toBeCloseTo(1_570.333 - 3_313.667, 2);
    expect(power.demandMw).toBeCloseTo(31_429.904, 2);
    expect(identity(power)).toBe(0);
    expect(headlineBalanceHolds(power)).toBe(true);
    expect(power.transmissionDemandMw).toBe(31_223);
    expect(formatHeadlineGw(power.generationMw)).toBe("33.2");
    expect(formatHeadlineGw(power.importsMw)).toBe("1.6");
    expect(formatHeadlineGw(power.exportsMw)).toBe("3.3");
    expect(formatHeadlineGw(power.demandMw)).toBe("31.4");
    expect(formatHeadlineGw(31_223 + 3160 + 386.737)).toBe("34.8");
    expect(power.demandDefinition).toContain("34.8");
    expect(power.terms.map((term) => term.label)).toEqual([
      "Generation",
      "Imports",
      "Exports",
      "Demand",
    ]);
    expect(power.showEquals).toBe(true);
  });

  it("renders the closed equation without the old 34.8 = 33.3 − 1.6 line", () => {
    const html = renderToStaticMarkup(<EquationRow power={power} />);
    expect(html).toContain('data-balanced="true"');
    expect(html).toContain(">33.2<");
    expect(html).toContain(">1.6<");
    expect(html).toContain(">3.3<");
    expect(html).toContain(">31.4<");
    expect(html).not.toContain(">33.3<");
    expect(html).not.toContain(">34.8<");
    expect(html).toContain("Imports");
    expect(html).toContain("Exports");
    expect(html).toContain("=");
    expect(html).not.toContain("Pumping");
  });
});

describe("headline identity cases", () => {
  it("shows pumping and battery charging as their own term", () => {
    const timestamp = "2026-10-10 11:00:00";
    const rows = [
      row(timestamp, "ccgt", 15_000),
      row(timestamp, "wind", 8_000),
      row(timestamp, "ps", -2_000),
      row(timestamp, "bess", -400),
      row(timestamp, "embedded_wind", 1_000, "neso"),
      row(timestamp, "intfr", 1_500),
      row(timestamp, "intned", -800),
    ];
    const power = getDisplayedPower(facts(rows, 20_000), [snapshot(timestamp, 20_000)]);

    expect(power.generationMw).toBe(24_000);
    expect(power.importsMw).toBe(1_500);
    expect(power.exportsMw).toBe(800);
    expect(power.storageChargingMw).toBe(2_400);
    expect(power.demandMw).toBe(22_300);
    expect(identity(power)).toBe(0);
    expect(headlineBalanceHolds(power)).toBe(true);
    expect(power.terms.map((term) => term.label)).toEqual([
      "Generation",
      "Imports",
      "Exports",
      "Storage",
      "Demand",
    ]);
    expect(power.showEquals).toBe(true);
  });

  it("keeps an import-only half-hour closed", () => {
    const timestamp = "2026-10-10 11:00:00";
    const rows = [
      row(timestamp, "ccgt", 10_000),
      row(timestamp, "wind", 12_000),
      row(timestamp, "intfr", 2_000),
      row(timestamp, "intned", 500),
    ];
    const power = getDisplayedPower(facts(rows, 30_000), [snapshot(timestamp, 30_000)]);

    expect(power.exportsMw).toBe(0);
    expect(power.storageChargingMw).toBe(0);
    expect(power.demandMw).toBe(24_500);
    expect(identity(power)).toBe(0);
    expect(power.terms.map((term) => term.label)).toEqual(["Generation", "Imports", "Demand"]);
    expect(power.showEquals).toBe(true);
  });

  it("keeps an export-only half-hour closed", () => {
    const timestamp = "2026-10-10 11:00:00";
    const rows = [
      row(timestamp, "ccgt", 20_000),
      row(timestamp, "wind", 14_000),
      row(timestamp, "ps", 500),
      row(timestamp, "intfr", -3_000),
      row(timestamp, "intirl", -600),
    ];
    const power = getDisplayedPower(facts(rows, 40_000), [snapshot(timestamp, 40_000)]);

    expect(power.generationMw).toBe(34_500);
    expect(power.importsMw).toBe(0);
    expect(power.exportsMw).toBe(3_600);
    expect(power.demandMw).toBe(30_900);
    expect(identity(power)).toBe(0);
    expect(power.terms.map((term) => term.label)).toEqual(["Generation", "Exports", "Demand"]);
    expect(power.showEquals).toBe(true);
  });

  it("averages the half-hour instead of keeping the last 5-minute sample", () => {
    const rows = [
      row("2026-10-13 07:30:00", "ccgt", 1_000),
      row("2026-10-13 07:55:00", "ccgt", 3_000),
      row("2026-10-13 07:30:00", "intfr", 100),
      row("2026-10-13 07:55:00", "intfr", 300),
    ];
    const power = getDisplayedPower(facts(rows), [snapshot("2026-10-13 07:30:00", 9_000)]);

    expect(power.generationMw).toBe(2_000);
    expect(power.importsMw).toBe(200);
    expect(power.demandMw).toBe(2_200);
    expect(identity(power)).toBe(0);
  });

  it("does not close the equation on a partial interconnector book", () => {
    const rows = [
      row("2026-10-13 07:30:00", "ccgt", 10_000),
      row("2026-10-13 07:30:00", "intned", 400),
      row("2026-10-13 07:00:00", "intfr", 900),
    ];
    const power = getDisplayedPower(facts(rows), [snapshot("2026-10-13 07:30:00", 12_000)]);

    expect(power.balanceClosed).toBe(false);
    expect(power.showEquals).toBe(false);
    expect(power.importsMw).toBeNull();
    expect(headlineBalanceHolds(power)).toBe(false);
  });

  it("withholds the equals sign when rounded gigawatts miss by more than 0.1", () => {
    expect(
      headlineTermsClose({
        generationMw: 249,
        importsMw: 249,
        exportsMw: 251,
        storageChargingMw: 251,
        demandMw: -4,
      })
    ).toBe(false);
    expect(
      headlineTermsClose({
        generationMw: 33_173.237,
        importsMw: 1_570.333,
        exportsMw: 3_313.667,
        storageChargingMw: 0,
        demandMw: 31_429.904,
      })
    ).toBe(true);
  });
});
