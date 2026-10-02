import { describe, expect, it } from "vitest";
import {
  alignAnswerPeriod,
  buildDemandBalanceChartPoints,
  buildGenerationAnswerStats,
  buildGenerationDeskView,
  buildNowBySourceView,
  generationSourceCopy,
  clipTrailingEmptyChartPoints,
  dropLeadingIncompleteChartPoints,
  demandBalanceGapLabel,
  demandBalanceXTicks,
  prepareDemandBalanceChartData,
  fillDailyCalendarSlots,
  ROLLING_AVERAGE_MIN_DAYS,
  formatDemandBalanceTick,
  formatPlainSettlementWindow,
  FUELINST_STALE_MS,
  fuelinstDelayNote,
  GENERATION_DESK_RANGE_OPTIONS,
  gwAxisTicks,
} from "@/lib/generation-desk-view";
import type { DemandBalancePoint } from "@/lib/dashboard-model";
import type { LatestFacts } from "@/lib/facts";
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

function snapshot(timestamp: string, demandMw: number | null): EnergySnapshot {
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

function facts(overrides: Partial<LatestFacts> = {}): LatestFacts {
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
    generationMw: fact(20215, "2026-09-28T07:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
    netImportsMw: fact(1147, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    pumpedStorageMw: fact(231, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    shares: [],
    generationRows: [],
    mixSnapshot: null,
    referenceTimestamp: "2026-09-28T07:00:00.000Z",
    ...overrides,
  };
}

describe("generation desk ranges", () => {
  it("includes every public range so the local toggle can stay pressed", () => {
    expect(GENERATION_DESK_RANGE_OPTIONS.map((option) => option.value)).toEqual([
      "24h",
      "7d",
      "30d",
      "90d",
      "1y",
    ]);
  });
});

describe("generation answer row", () => {
  it("formats settlement time without the SP number", () => {
    expect(formatPlainSettlementWindow("2026-09-27 11:00:00")).toBe("12:00–12:30 BST");
  });

  it("adds embedded generation onto ITSDO so demand matches the generation basis", () => {
    const view = buildGenerationDeskView(
      facts({
        generationMw: fact(20215, "2026-09-28T07:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(24000, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 07:00:00", "ccgt", 7563),
          generation("2026-09-28 07:00:00", "wind", 3746),
          generation("2026-09-28 07:00:00", "embedded_wind", 917, "neso"),
          generation("2026-09-28 07:00:00", "embedded_solar", 800, "pvlive"),
        ],
      }),
      new Date("2026-09-28T07:10:00.000Z")
    );

    expect(view.answers[1]?.value).toBe("25.7");
    expect(view.answers[1]?.source).toBe("Elexon BMRS");
  });

  it("builds generating, demand, and net imports in GW with source and window", () => {
    const stats = buildGenerationAnswerStats(facts());

    expect(stats.map((stat) => stat.stat)).toEqual(["generating", "demand", "net_imports"]);
    expect(stats[0]).toMatchObject({
      label: "Generating",
      value: "20.2",
      unit: "GW",
      source: "Elexon BMRS, NESO, Sheffield Solar PV Live",
      timeLabel: "08:00–08:30 BST",
    });
    expect(stats[1]?.value).toBe("24.0");
    expect(stats[2]?.value).toBe("1.1");
  });

  it("renders missing facts as an em dash", () => {
    const stats = buildGenerationAnswerStats(
      facts({
        generationMw: fact(null, null, "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(null, null, "Elexon BMRS"),
        netImportsMw: fact(null, null, "Elexon BMRS"),
      })
    );

    expect(stats.map((stat) => stat.value)).toEqual(["—", "—", "—"]);
    expect(stats.map((stat) => stat.timeLabel)).toEqual([null, null, null]);
  });

  it("aligns generating, demand, and net imports to the latest complete settlement period", () => {
    const view = buildGenerationDeskView(
      facts({
        generationMw: fact(20215, "2026-09-28T03:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(21500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(1147, "2026-09-28T03:00:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 03:00:00", "ccgt", 8000),
          generation("2026-09-28 03:00:00", "wind", 4000),
          generation("2026-09-28 03:00:00", "intfr", 1147),
          generation("2026-09-28 02:30:00", "ccgt", 10000),
          generation("2026-09-28 02:30:00", "wind", 9000),
          generation("2026-09-28 02:30:00", "intfr", -800),
        ],
      }),
      new Date("2026-09-28T03:10:00.000Z")
    );

    expect(view.answers.map((stat) => stat.timeLabel)).toEqual([
      "03:30–04:00 BST",
      "03:30–04:00 BST",
      "03:30–04:00 BST",
    ]);
    expect(view.answers[0]?.value).toBe("19.0");
    expect(view.answers[1]?.value).toBe("21.5");
    expect(view.answers[2]?.value).toBe("-0.8");
    expect(view.alignmentNote).toBe(
      "Demand for 04:00–04:30 BST is not in yet. Figures are 03:30–04:00 BST."
    );
    expect(view.nowView.totalMw).toBe(19000);
    expect(view.nowView.rows.map((row) => row.fuel).slice(0, 2)).toEqual(["gas", "wind"]);
  });

  it("does not carry an older interconnector into the aligned settlement period", () => {
    const aligned = alignAnswerPeriod(
      facts({
        generationMw: fact(20215, "2026-09-28T03:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(21500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(1147, "2026-09-28T03:00:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 03:00:00", "ccgt", 8000),
          generation("2026-09-28 03:00:00", "intfr", 1147),
          generation("2026-09-28 02:30:00", "ccgt", 10000),
          generation("2026-09-28 02:30:00", "wind", 9000),
          generation("2026-09-28 02:00:00", "intfr", 900),
        ],
      })
    );

    expect(aligned.netImportsMw.value).toBeNull();
    expect(aligned.generationMw.value).toBe(19000);
  });

  it("hides the live delay note on a historical day", () => {
    const view = buildGenerationDeskView(
      facts({
        isHistorical: true,
        generationRows: [generation("2026-09-20 03:00:00", "ccgt", 8000)],
      }),
      new Date("2026-09-28T12:00:00.000Z")
    );

    expect(view.delayNote).toBeNull();
  });

  it("keeps a positive net-imports sign when GB is importing", () => {
    const aligned = alignAnswerPeriod(
      facts({
        generationMw: fact(19000, "2026-09-28T02:30:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(21500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(1500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 02:30:00", "ccgt", 10000),
          generation("2026-09-28 02:30:00", "wind", 9000),
          generation("2026-09-28 02:30:00", "intfr", 1500),
        ],
      })
    );

    expect(aligned.alignmentNote).toBeNull();
    expect(aligned.netImportsMw.value).toBe(1500);
    expect(buildGenerationAnswerStats({
      ...facts(),
      netImportsMw: aligned.netImportsMw,
    })[2]?.value).toBe("1.5");
  });

  it("rejects a partial interconnector book as the national net-imports total", () => {
    const aligned = alignAnswerPeriod(
      facts({
        generationMw: fact(19000, "2026-09-28T02:30:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(21500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(1300, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 02:30:00", "ccgt", 10000),
          generation("2026-09-28 02:30:00", "wind", 9000),
          generation("2026-09-28 02:30:00", "intned", 400),
          generation("2026-09-28 02:00:00", "intfr", 900),
        ],
      })
    );

    expect(aligned.alignmentNote).toBeNull();
    expect(aligned.netImportsMw.value).toBeNull();
    expect(aligned.netImportsMw.periodStartUtc).toBe("2026-09-28T02:30:00.000Z");
    expect(aligned.demand.value).toBe(21500);
  });

  it("publishes net imports only when every connector is in the target period", () => {
    const complete = alignAnswerPeriod(
      facts({
        generationMw: fact(19000, "2026-09-28T02:30:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(21500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(1300, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 02:30:00", "ccgt", 10000),
          generation("2026-09-28 02:30:00", "wind", 9000),
          generation("2026-09-28 02:30:00", "intned", 400),
          generation("2026-09-28 02:30:00", "intfr", 900),
        ],
      })
    );

    expect(complete.netImportsMw.value).toBe(1300);
  });

  it("does not pair newer demand with older generation when no matching snapshot exists", () => {
    const view = buildGenerationDeskView(
      facts({
        generationMw: fact(19000, "2026-09-28T02:30:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(25000, "2026-09-28T03:00:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(1300, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 02:30:00", "ccgt", 10000),
          generation("2026-09-28 02:30:00", "wind", 9000),
          generation("2026-09-28 02:30:00", "intned", 400),
          generation("2026-09-28 02:00:00", "intfr", 900),
        ],
      }),
      new Date("2026-09-28T03:10:00.000Z")
    );

    expect(view.answers.map((stat) => stat.timeLabel)).toEqual([
      "03:30–04:00 BST",
      "03:30–04:00 BST",
      "03:30–04:00 BST",
    ]);
    expect(view.answers[0]?.value).toBe("19.0");
    expect(view.answers[1]?.value).toBe("—");
    expect(view.answers[2]?.value).toBe("—");
    expect(view.alignmentNote).toBe(
      "Demand is 04:00–04:30 BST. Generation is 03:30–04:00 BST."
    );
    expect(view.nowView.totalSharePctLabel).toBe("100.0%");
    expect(view.nowView.rows.find((row) => row.fuel === "gas")?.sharePctLabel).toBe("52.6%");
  });

  it("uses demand at the generation settlement period when a newer demand is also present", () => {
    const view = buildGenerationDeskView(
      facts({
        generationMw: fact(19000, "2026-09-28T02:30:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
        demand: fact(25000, "2026-09-28T03:00:00.000Z", "Elexon BMRS"),
        netImportsMw: fact(1300, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
        generationRows: [
          generation("2026-09-28 02:30:00", "ccgt", 10000),
          generation("2026-09-28 02:30:00", "wind", 9000),
          generation("2026-09-28 02:30:00", "intned", 400),
          generation("2026-09-28 02:00:00", "intfr", 900),
        ],
      }),
      new Date("2026-09-28T03:10:00.000Z"),
      [
        snapshot("2026-09-28 02:30:00", 21500),
        snapshot("2026-09-28 03:00:00", 25000),
      ]
    );

    expect(view.answers.map((stat) => stat.timeLabel)).toEqual([
      "03:30–04:00 BST",
      "03:30–04:00 BST",
      "03:30–04:00 BST",
    ]);
    expect(view.answers[0]?.value).toBe("19.0");
    expect(view.answers[1]?.value).toBe("21.5");
    expect(view.answers[2]?.value).toBe("—");
    expect(view.alignmentNote).toBeNull();
    expect(view.nowView.totalSharePctLabel).toBe("100.0%");
    expect(view.nowView.rows.find((row) => row.fuel === "gas")?.sharePctLabel).toBe("52.6%");
  });

  it("recovers half-hour demand from native headline snapshots, not a daily chart bucket", () => {
    const newerDemand = facts({
      generationMw: fact(19000, "2026-09-28T02:30:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
      demand: fact(25000, "2026-09-28T03:00:00.000Z", "Elexon BMRS"),
      netImportsMw: fact(1300, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
      generationRows: [
        generation("2026-09-28 02:30:00", "ccgt", 10000),
        generation("2026-09-28 02:30:00", "wind", 9000),
        generation("2026-09-28 02:30:00", "intned", 400),
      ],
    });
    const now = new Date("2026-09-28T03:10:00.000Z");
    const dailyChart = buildGenerationDeskView(newerDemand, now, [
      snapshot("2026-09-28 00:00:00", 25000),
    ]);
    const headline = buildGenerationDeskView(newerDemand, now, [
      snapshot("2026-09-28 02:30:00", 21500),
    ]);

    expect(dailyChart.answers[1]?.value).toBe("—");
    expect(dailyChart.nowView.totalSharePctLabel).toBe("100.0%");
    expect(headline.answers[1]?.value).toBe("21.5");
    expect(headline.nowView.totalSharePctLabel).toBe("100.0%");
  });

  it("does not restamp a later demand onto an older period across a FUELINST gap", () => {
    const gap = facts({
      generationMw: fact(8000, "2026-09-28T03:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
      demand: fact(21500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
      netImportsMw: fact(1147, "2026-09-28T03:00:00.000Z", "Elexon BMRS"),
      generationRows: [
        generation("2026-09-28 03:00:00", "ccgt", 8000),
        generation("2026-09-28 03:00:00", "intfr", 1147),
        generation("2026-09-28 02:00:00", "ccgt", 10000),
        generation("2026-09-28 02:00:00", "wind", 9000),
        generation("2026-09-28 02:00:00", "intfr", -400),
      ],
    });
    const now = new Date("2026-09-28T03:10:00.000Z");
    const withoutSnapshot = buildGenerationDeskView(gap, now);
    const withSnapshot = buildGenerationDeskView(gap, now, [
      snapshot("2026-09-28 02:00:00", 20000),
      snapshot("2026-09-28 02:30:00", 21500),
    ]);

    expect(withoutSnapshot.answers.map((stat) => stat.timeLabel)).toEqual([
      "03:00–03:30 BST",
      "03:00–03:30 BST",
      "03:00–03:30 BST",
    ]);
    expect(withoutSnapshot.answers[0]?.value).toBe("19.0");
    expect(withoutSnapshot.answers[1]?.value).toBe("—");
    expect(withoutSnapshot.answers[2]?.value).toBe("-0.4");
    expect(withoutSnapshot.nowView.totalSharePctLabel).toBe("100.0%");
    expect(withoutSnapshot.alignmentNote).toBe(
      "Demand is 03:30–04:00 BST. Generation is 03:00–03:30 BST."
    );
    expect(withSnapshot.answers[1]?.value).toBe("20.0");
    expect(withSnapshot.nowView.totalSharePctLabel).toBe("100.0%");
    expect(withSnapshot.alignmentNote).toBe(
      "Demand for 04:00–04:30 BST is not in yet. Figures are 03:00–03:30 BST."
    );
  });
});

describe("generation source copy", () => {
  it("names the live card now and the historical card by settlement time", () => {
    const live = facts({
      generationRows: [generation("2026-09-28 07:00:00", "ccgt", 8000)],
    });
    expect(generationSourceCopy(live).title).toBe("Powering Britain now");
    expect(generationSourceCopy(live).subtitle).toContain("Now, by source");
    expect(generationSourceCopy(live).tooltip).toContain("latest Elexon FUELINST");
    expect(generationSourceCopy(live).tooltip).toContain("joined at or within one hour");
    expect(generationSourceCopy(live).tooltip).not.toContain("30 minutes");

    const historical = generationSourceCopy(
      facts({
        isHistorical: true,
        requestedDate: "2026-09-20",
        generationMw: fact(8000, "2026-09-20T22:30:00.000Z", "Elexon BMRS"),
        generationRows: [generation("2026-09-20 22:30:00", "ccgt", 8000)],
        referenceTimestamp: "2026-09-20T22:30:00.000Z",
      })
    );

    expect(historical.title).toBe("Powering Britain at 23:30 BST on 20 Sep 2026");
    expect(historical.subtitle).toBe("By source · sorted by size · share of supply");
    expect(historical.tooltip).toContain("Elexon FUELINST frame at 23:30 BST on 20 Sep 2026");
    expect(historical.tooltip).toContain("joined at or within one hour");
    expect(historical.tooltip).not.toContain("latest");
    expect(historical.tooltip).not.toContain(" now");
    expect(historical.tooltipLabel).toBe("What is Powering Britain at 23:30 BST on 20 Sep 2026?");
  });

  it("titles the source card from the aligned frame, not a newer unused FUELINST row", () => {
    const lagged = facts({
      isHistorical: true,
      requestedDate: "2026-09-28",
      generationMw: fact(20215, "2026-09-28T03:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
      demand: fact(21500, "2026-09-28T02:30:00.000Z", "Elexon BMRS"),
      netImportsMw: fact(1147, "2026-09-28T03:00:00.000Z", "Elexon BMRS"),
      generationRows: [
        generation("2026-09-28 03:00:00", "ccgt", 8000),
        generation("2026-09-28 03:00:00", "wind", 4000),
        generation("2026-09-28 02:30:00", "ccgt", 10000),
        generation("2026-09-28 02:30:00", "wind", 9000),
      ],
      referenceTimestamp: "2026-09-28T03:00:00.000Z",
    });
    const view = buildGenerationDeskView(lagged, new Date("2026-09-28T03:10:00.000Z"));

    expect(view.answers[0]?.value).toBe("19.0");
    expect(view.sourceCopy.title).toBe("Powering Britain at 03:30 BST on 28 Sep 2026");
    expect(view.sourceCopy.tooltip).toContain("Elexon FUELINST frame at 03:30 BST on 28 Sep 2026");
    expect(view.sourceCopy.tooltip).not.toContain("latest");
    expect(view.sourceCopy.tooltip).not.toContain("04:00 BST");

    const live = buildGenerationDeskView(
      { ...lagged, isHistorical: false },
      new Date("2026-09-28T03:10:00.000Z")
    );
    expect(live.sourceCopy.title).toBe("Powering Britain at 03:30 BST on 28 Sep 2026");
    expect(live.sourceCopy.tooltip).not.toContain("latest");
  });

  it("does not date a missing generation frame from snapshot reference time", () => {
    const missingGeneration = facts({
      isHistorical: true,
      requestedDate: "2026-09-20",
      generationMw: fact(null, null, "Elexon BMRS, NESO, Sheffield Solar PV Live"),
      generationRows: [],
      referenceTimestamp: "2026-09-20T22:30:00.000Z",
      demand: fact(21000, "2026-09-20T22:30:00.000Z", "Elexon BMRS"),
    });
    const copy = generationSourceCopy(missingGeneration);
    const view = buildGenerationDeskView(
      missingGeneration,
      new Date("2026-09-28T12:00:00.000Z")
    );

    expect(copy.title).toBe("Powering Britain on 20 Sep 2026");
    expect(copy.tooltip).toBe(
      "No Elexon FUELINST frame is available for 20 Sep 2026. Net imports are their own slice of total supply."
    );
    expect(copy.tooltip).not.toContain("23:30");
    expect(copy.tooltip).not.toContain("frame at");
    expect(view.sourceCopy.title).toBe("Powering Britain on 20 Sep 2026");
    expect(view.sourceCopy.tooltip).not.toContain("23:30 BST");
  });

  it("renders no-frame copy when live generation is unavailable", () => {
    const missingGeneration = facts({
      generationMw: fact(null, null, "Elexon BMRS, NESO, Sheffield Solar PV Live"),
      generationRows: [],
      referenceTimestamp: "2026-09-28T07:00:00.000Z",
      demand: fact(24000, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    });
    const copy = generationSourceCopy(missingGeneration);
    const view = buildGenerationDeskView(
      missingGeneration,
      new Date("2026-09-28T07:10:00.000Z")
    );

    expect(copy.title).toBe("Powering Britain on 28 Sep 2026");
    expect(copy.tooltip).toBe(
      "No Elexon FUELINST frame is available for 28 Sep 2026. Net imports are their own slice of total supply."
    );
    expect(copy.tooltip).not.toContain("latest");
    expect(copy.subtitle).not.toContain("Now");
    expect(view.sourceCopy.title).toBe("Powering Britain on 28 Sep 2026");
    expect(view.sourceCopy.tooltip).not.toContain("latest Elexon FUELINST");
  });
});

describe("fuelinst stale threshold", () => {
  const rows = [generation("2026-09-28 03:00:00", "ccgt", 8000)];

  it("is silent within one hourly cron cycle plus grace and notes a delay after that", () => {
    expect(FUELINST_STALE_MS).toBe(90 * 60 * 1000);
    expect(fuelinstDelayNote(rows, new Date("2026-09-28T04:30:00.000Z"))).toBeNull();
    expect(fuelinstDelayNote(rows, new Date("2026-09-28T03:45:00.000Z"))).toBeNull();
    expect(fuelinstDelayNote(rows, new Date("2026-09-28T04:30:01.000Z"))).toBe(
      "Data delayed: last Elexon update 04:00 BST"
    );
  });
});

describe("now by source", () => {
  const rows: Generation5min[] = [
    generation("2026-09-28 07:00:00", "ccgt", 7563),
    generation("2026-09-28 07:00:00", "wind", 3746),
    generation("2026-09-28 07:00:00", "nuclear", 4015),
    generation("2026-09-28 07:00:00", "biomass", 2948),
    generation("2026-09-28 07:00:00", "npshyd", 571),
    generation("2026-09-28 07:00:00", "ps", 231),
    generation("2026-09-28 07:00:00", "other", 224),
    generation("2026-09-28 07:00:00", "intfr", 396),
    generation("2026-09-28 04:00:00", "embedded_wind", 917, "neso"),
    generation("2026-09-28 07:00:00", "embedded_solar", 0, "pvlive"),
  ];

  it("sorts present sources by GW and keeps missing fuels as no-data rows", () => {
    const view = buildNowBySourceView(rows);
    const supplyMw = 19298 + 396;

    expect(view.rows.map((row) => row.fuel)).toEqual([
      "gas",
      "nuclear",
      "wind",
      "biomass",
      "hydro",
      "imports",
      "other",
      "embedded_solar",
      "embedded_wind",
      "coal",
    ]);
    expect(view.rows[0]).toMatchObject({
      fuel: "gas",
      gwLabel: "7.6",
      sharePctLabel: "38.4%",
    });
    expect(view.rows.find((row) => row.fuel === "imports")).toMatchObject({
      gwLabel: "0.4",
      sharePctLabel: "2.0%",
    });
    expect(view.rows.find((row) => row.fuel === "embedded_solar")).toMatchObject({
      gwLabel: "0.0",
      missingNote: null,
    });
    expect(view.rows.find((row) => row.fuel === "embedded_wind")).toMatchObject({
      gwLabel: "—",
      sharePctLabel: "—",
      missingNote: "no data since 05:00 BST",
    });
    expect(view.rows.find((row) => row.fuel === "coal")).toMatchObject({
      gwLabel: "—",
      sharePctLabel: "—",
      missingNote: "no data",
    });
    expect(view.totalMw).toBe(supplyMw);
    expect(view.totalGwLabel).toBe("19.7");
    expect(view.totalSharePctLabel).toBe("100.0%");
    expect(view.stacked.map((segment) => segment.fuel)).toEqual([
      "gas",
      "nuclear",
      "wind",
      "biomass",
      "hydro",
      "imports",
      "other",
    ]);
    expect(view.stacked.reduce((sum, segment) => sum + segment.pct, 0)).toBeCloseTo(100, 5);
    expect(view.stacked.find((segment) => segment.fuel === "gas")?.pct).toBeCloseTo(
      (7563 / supplyMw) * 100,
      5
    );
  });

  it("keeps a single gas share of total supply", () => {
    const view = buildNowBySourceView([
      generation("2026-09-28 07:00:00", "ccgt", 7000),
      generation("2026-09-28 07:00:00", "ocgt", 563),
      generation("2026-09-28 07:00:00", "wind", 3746),
      generation("2026-09-28 07:00:00", "intfr", 396),
    ]);

    const gasRows = view.rows.filter((row) => row.fuel === "gas");
    const stackedGas = view.stacked.find((row) => row.fuel === "gas");
    expect(gasRows).toHaveLength(1);
    expect(gasRows[0]?.mw).toBe(7563);
    expect(gasRows[0]?.sharePctLabel).toBe(`${stackedGas?.pct.toFixed(1)}%`);
  });

  it("keeps the total percentage missing when no generation sources exist", () => {
    const view = buildNowBySourceView([]);

    expect(view.totalGwLabel).toBe("—");
    expect(view.totalSharePctLabel).toBe("—");
    expect(view.totalSharePctLabel).not.toBe("0.0%");
    expect(view.rows.every((row) => row.sharePctLabel === "—")).toBe(true);
  });
});

describe("demand balance chart view", () => {
  it("converts MW to GW and shades the import/export gap", () => {
    const points = buildDemandBalanceChartPoints([
      {
        time: "2026-09-28 07:00:00",
        demandMw: 24000,
        domesticGenerationMw: 20000,
        embeddedMissing: [],
      },
      {
        time: "2026-09-28 07:30:00",
        demandMw: 18000,
        domesticGenerationMw: 22000,
        embeddedMissing: [],
      },
      {
        time: "2026-09-28 08:00:00",
        demandMw: null,
        domesticGenerationMw: 21000,
        embeddedMissing: ["embedded_wind"],
      },
    ]);

    expect(points[0]).toEqual({
      time: "2026-09-28 07:00:00",
      demandGw: 24,
      generationGw: 20,
      demandDailyGw: null,
      generationDailyGw: null,
      gapBaseGw: 20,
      importGw: 4,
      exportGw: 0,
      embeddedMissing: [],
    });
    expect(points[1]).toEqual({
      time: "2026-09-28 07:30:00",
      demandGw: 18,
      generationGw: 22,
      demandDailyGw: null,
      generationDailyGw: null,
      gapBaseGw: 18,
      importGw: 0,
      exportGw: 4,
      embeddedMissing: [],
    });
    expect(points[2]).toEqual({
      time: "2026-09-28 08:00:00",
      demandGw: null,
      generationGw: 21,
      demandDailyGw: null,
      generationDailyGw: null,
      gapBaseGw: null,
      importGw: null,
      exportGw: null,
      embeddedMissing: ["embedded_wind"],
    });
  });

  it("uses round GW ticks and 24h ticks every three hours", () => {
    expect(gwAxisTicks(37.4)).toEqual([0, 10, 20, 30, 40]);
    expect(gwAxisTicks(65)).toEqual([0, 20, 40, 60, 80]);

    const times = [
      "2026-01-15 00:00:00",
      "2026-01-15 00:30:00",
      "2026-01-15 03:00:00",
      "2026-01-15 06:00:00",
      "2026-01-15 06:30:00",
      "2026-01-15 12:00:00",
    ];
    expect(demandBalanceXTicks(times, "24h")).toEqual([
      "2026-01-15 00:00:00",
      "2026-01-15 03:00:00",
      "2026-01-15 06:00:00",
      "2026-01-15 12:00:00",
    ]);
    expect(formatDemandBalanceTick("2026-09-28 06:00:00", "24h")).toBe("07:00");
    expect(formatDemandBalanceTick("2026-01-15 00:00:00", "1y")).toBe("Jan");
  });

  it("labels the import and export gap in GW", () => {
    const points = buildDemandBalanceChartPoints([
      {
        time: "2026-09-28 07:00:00",
        demandMw: 24000,
        domesticGenerationMw: 20000,
        embeddedMissing: [],
      },
      {
        time: "2026-09-28 07:30:00",
        demandMw: 18000,
        domesticGenerationMw: 22000,
        embeddedMissing: [],
      },
      {
        time: "2026-09-28 08:00:00",
        demandMw: 20000,
        domesticGenerationMw: 20000,
        embeddedMissing: [],
      },
    ]);

    expect(demandBalanceGapLabel(points[0] ?? emptyPoint())).toBe(
      "Imports (demand above generation): 4.0 GW"
    );
    expect(demandBalanceGapLabel(points[1] ?? emptyPoint())).toBe(
      "Exports (generation above demand): 4.0 GW"
    );
    expect(demandBalanceGapLabel(points[2] ?? emptyPoint())).toBe("Gap: 0.0 GW");
  });

  it("clips trailing empty 24h points and uses at most four compact ticks", () => {
    const points = buildDemandBalanceChartPoints([
      {
        time: "2026-01-15 00:00:00",
        demandMw: 20000,
        domesticGenerationMw: 18000,
        embeddedMissing: [],
      },
      {
        time: "2026-01-15 06:00:00",
        demandMw: 21000,
        domesticGenerationMw: 19000,
        embeddedMissing: [],
      },
      {
        time: "2026-01-15 09:00:00",
        demandMw: null,
        domesticGenerationMw: null,
        embeddedMissing: [],
      },
    ]);
    const clipped = clipTrailingEmptyChartPoints(points);

    expect(clipped.map((point) => point.time)).toEqual([
      "2026-01-15 00:00:00",
      "2026-01-15 06:00:00",
    ]);

    const times = [
      "2026-01-15 00:00:00",
      "2026-01-15 03:00:00",
      "2026-01-15 06:00:00",
      "2026-01-15 09:00:00",
      "2026-01-15 12:00:00",
      "2026-01-15 15:00:00",
      "2026-01-15 18:00:00",
      "2026-01-15 21:00:00",
    ];
    expect(demandBalanceXTicks(times, "24h", true)).toEqual([
      "2026-01-15 00:00:00",
      "2026-01-15 06:00:00",
      "2026-01-15 12:00:00",
      "2026-01-15 18:00:00",
    ]);
  });

  it("drops leading 24h points that are missing embedded generation", () => {
    const series: DemandBalancePoint[] = [
      {
        time: "2026-09-27 10:00:00",
        demandMw: 27000,
        domesticGenerationMw: 21000,
        embeddedMissing: ["embedded_wind", "embedded_solar"],
      },
      {
        time: "2026-09-27 10:30:00",
        demandMw: 28000,
        domesticGenerationMw: 30000,
        embeddedMissing: [],
      },
      {
        time: "2026-09-27 11:00:00",
        demandMw: 28500,
        domesticGenerationMw: 30200,
        embeddedMissing: [],
      },
    ];
    const points = prepareDemandBalanceChartData(series, "24h");

    expect(points.map((point) => point.time)).toEqual([
      "2026-09-27 10:30:00",
      "2026-09-27 11:00:00",
    ]);
    expect(points[0]?.generationGw).toBe(30);
    expect(prepareDemandBalanceChartData(series, "7d").map((point) => point.time)).toEqual([
      "2026-09-27 10:00:00",
      "2026-09-27 10:30:00",
      "2026-09-27 11:00:00",
    ]);
  });

  it("keeps a leading incomplete 24h point when every point is incomplete", () => {
    const points = dropLeadingIncompleteChartPoints(
      buildDemandBalanceChartPoints([
        {
          time: "2026-09-27 10:00:00",
          demandMw: 27000,
          domesticGenerationMw: 21000,
          embeddedMissing: ["embedded_wind"],
        },
        {
          time: "2026-09-27 10:30:00",
          demandMw: 28000,
          domesticGenerationMw: 22000,
          embeddedMissing: ["embedded_wind"],
        },
      ])
    );

    expect(points).toHaveLength(2);
  });

  it("smooths 1y and 90d with a 7-day average over daily values", () => {
    const series: DemandBalancePoint[] = [10, 20, 30, 40, 50, 60, 70].map((gw, index) => ({
      time: `2026-01-0${index + 1} 00:00:00`,
      demandMw: gw * 1000,
      domesticGenerationMw: (gw - 2) * 1000,
      embeddedMissing: [],
    }));
    const points = prepareDemandBalanceChartData(series, "1y");
    const last = points.at(-1);

    expect(last?.demandDailyGw).toBe(70);
    expect(last?.generationDailyGw).toBe(68);
    expect(last?.demandGw).toBe(40);
    expect(last?.generationGw).toBe(38);
    expect(last?.importGw).toBe(2);
    expect(points[0]?.demandGw).toBeNull();
    expect(points[3]?.demandGw).toBe(25);
    expect(points[3]?.generationGw).toBe(23);
    expect(prepareDemandBalanceChartData(series, "90d").at(-1)?.demandGw).toBe(40);
    expect(prepareDemandBalanceChartData(series, "30d").at(-1)?.demandGw).toBe(70);
  });

  it("does not invent a rolling average or gap on a day whose series is missing", () => {
    const missingGeneration = prepareDemandBalanceChartData(
      [
        {
          time: "2026-01-01 00:00:00",
          demandMw: 10000,
          domesticGenerationMw: 8000,
          embeddedMissing: [],
        },
        {
          time: "2026-01-02 00:00:00",
          demandMw: 20000,
          domesticGenerationMw: 18000,
          embeddedMissing: [],
        },
        {
          time: "2026-01-03 00:00:00",
          demandMw: 30000,
          domesticGenerationMw: null,
          embeddedMissing: [],
        },
        {
          time: "2026-01-04 00:00:00",
          demandMw: 40000,
          domesticGenerationMw: 38000,
          embeddedMissing: [],
        },
      ],
      "1y"
    );
    const hole = missingGeneration[2];

    expect(hole?.demandDailyGw).toBe(30);
    expect(hole?.demandGw).toBeNull();
    expect(hole?.generationDailyGw).toBeNull();
    expect(hole?.generationGw).toBeNull();
    expect(hole?.importGw).toBeNull();
    expect(hole?.exportGw).toBeNull();
    expect(hole?.gapBaseGw).toBeNull();

    const missingDemand = prepareDemandBalanceChartData(
      [
        {
          time: "2026-01-01 00:00:00",
          demandMw: 10000,
          domesticGenerationMw: 8000,
          embeddedMissing: [],
        },
        {
          time: "2026-01-02 00:00:00",
          demandMw: null,
          domesticGenerationMw: 18000,
          embeddedMissing: [],
        },
      ],
      "90d"
    );

    expect(missingDemand[1]?.demandDailyGw).toBeNull();
    expect(missingDemand[1]?.demandGw).toBeNull();
    expect(missingDemand[1]?.generationDailyGw).toBe(18);
    expect(missingDemand[1]?.generationGw).toBeNull();
    expect(missingDemand[1]?.importGw).toBeNull();
    expect(missingDemand[1]?.exportGw).toBeNull();
  });

  it("averages demand and generation over the same paired days", () => {
    expect(ROLLING_AVERAGE_MIN_DAYS).toBe(4);

    const series: DemandBalancePoint[] = [
      { time: "2026-01-01 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-02 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-03 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-04 00:00:00", demandMw: 80000, domesticGenerationMw: null, embeddedMissing: [] },
      { time: "2026-01-05 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-06 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-07 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
    ];
    const points = prepareDemandBalanceChartData(series, "1y");
    const last = points.at(-1);
    const hole = points[3];

    expect(hole?.demandDailyGw).toBe(80);
    expect(hole?.generationDailyGw).toBeNull();
    expect(hole?.demandGw).toBeNull();
    expect(hole?.generationGw).toBeNull();
    expect(hole?.importGw).toBeNull();
    expect(last?.demandDailyGw).toBe(20);
    expect(last?.generationDailyGw).toBe(20);
    expect(last?.demandGw).toBe(20);
    expect(last?.generationGw).toBe(20);
    expect(last?.importGw).toBe(0);
    expect(last?.exportGw).toBe(0);
  });

  it("masks both rolling series when either current sample is missing", () => {
    const series: DemandBalancePoint[] = [
      { time: "2026-01-01 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-02 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-03 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-04 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
      { time: "2026-01-05 00:00:00", demandMw: 80000, domesticGenerationMw: null, embeddedMissing: [] },
      { time: "2026-01-06 00:00:00", demandMw: null, domesticGenerationMw: 18000, embeddedMissing: [] },
      { time: "2026-01-07 00:00:00", demandMw: 20000, domesticGenerationMw: 20000, embeddedMissing: [] },
    ];
    const points = prepareDemandBalanceChartData(series, "1y");
    const missingGeneration = points[4];
    const missingDemand = points[5];
    const last = points.at(-1);

    expect(missingGeneration?.demandDailyGw).toBe(80);
    expect(missingGeneration?.generationDailyGw).toBeNull();
    expect(missingGeneration?.demandGw).toBeNull();
    expect(missingGeneration?.generationGw).toBeNull();
    expect(missingDemand?.demandDailyGw).toBeNull();
    expect(missingDemand?.generationDailyGw).toBe(18);
    expect(missingDemand?.demandGw).toBeNull();
    expect(missingDemand?.generationGw).toBeNull();
    expect(last?.demandGw).toBe(20);
    expect(last?.generationGw).toBe(20);
    expect(last?.importGw).toBe(0);
  });

  it("keeps an absent calendar day as a hole in the 7-day window", () => {
    const series: DemandBalancePoint[] = [10, 20, 30, 40, 50, 60, 70].map((gw, index) => {
      const day = index < 5 ? index + 1 : index + 2;
      return {
        time: `2026-01-0${day} 00:00:00`,
        demandMw: gw * 1000,
        domesticGenerationMw: (gw - 2) * 1000,
        embeddedMissing: [],
      };
    });

    const filled = fillDailyCalendarSlots(buildDemandBalanceChartPoints(series));
    expect(filled.map((point) => point.time)).toEqual([
      "2026-01-01 00:00:00",
      "2026-01-02 00:00:00",
      "2026-01-03 00:00:00",
      "2026-01-04 00:00:00",
      "2026-01-05 00:00:00",
      "2026-01-06 00:00:00",
      "2026-01-07 00:00:00",
      "2026-01-08 00:00:00",
    ]);
    expect(filled[5]).toMatchObject({
      demandGw: null,
      generationGw: null,
    });

    const points = prepareDemandBalanceChartData(series, "1y");
    const hole = points[5];
    const last = points.at(-1);

    expect(points).toHaveLength(8);
    expect(hole?.time).toBe("2026-01-06 00:00:00");
    expect(hole?.demandDailyGw).toBeNull();
    expect(hole?.generationDailyGw).toBeNull();
    expect(hole?.demandGw).toBeNull();
    expect(hole?.generationGw).toBeNull();
    expect(hole?.importGw).toBeNull();
    expect(hole?.exportGw).toBeNull();
    expect(hole?.gapBaseGw).toBeNull();
    expect(last?.demandDailyGw).toBe(70);
    expect(last?.generationDailyGw).toBe(68);
    expect(last?.demandGw).toBe(45);
    expect(last?.generationGw).toBe(43);
    expect(last?.importGw).toBe(2);
    expect(prepareDemandBalanceChartData(series, "90d").at(-1)?.demandGw).toBe(45);
    expect(prepareDemandBalanceChartData(series, "30d").map((point) => point.time)).toEqual([
      "2026-01-01 00:00:00",
      "2026-01-02 00:00:00",
      "2026-01-03 00:00:00",
      "2026-01-04 00:00:00",
      "2026-01-05 00:00:00",
      "2026-01-07 00:00:00",
      "2026-01-08 00:00:00",
    ]);
  });
});

function emptyPoint() {
  return {
    time: "2026-09-28 07:00:00",
    demandGw: null,
    generationGw: null,
    demandDailyGw: null,
    generationDailyGw: null,
    gapBaseGw: null,
    importGw: null,
    exportGw: null,
    embeddedMissing: [],
  };
}
