import { describe, expect, it } from "vitest";
import {
  alignAnswerPeriod,
  buildDemandBalanceChartPoints,
  buildGenerationAnswerStats,
  buildGenerationDeskView,
  buildNowBySourceView,
  clipTrailingEmptyChartPoints,
  demandBalanceGapLabel,
  demandBalanceXTicks,
  formatDemandBalanceTick,
  formatPlainSettlementWindow,
  FUELINST_STALE_MS,
  fuelinstDelayNote,
  gwAxisTicks,
} from "@/lib/generation-desk-view";
import type { LatestFacts } from "@/lib/facts";
import type { Generation5min } from "@/lib/types";

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

describe("generation answer row", () => {
  it("formats settlement time without the SP number", () => {
    expect(formatPlainSettlementWindow("2026-09-27 11:00:00")).toBe("12:00–12:30 BST");
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
});

describe("fuelinst stale threshold", () => {
  const rows = [generation("2026-09-28 03:00:00", "ccgt", 8000)];

  it("is silent at or under 30 minutes and notes a delay after that", () => {
    expect(FUELINST_STALE_MS).toBe(30 * 60 * 1000);
    expect(fuelinstDelayNote(rows, new Date("2026-09-28T03:30:00.000Z"))).toBeNull();
    expect(fuelinstDelayNote(rows, new Date("2026-09-28T03:20:00.000Z"))).toBeNull();
    expect(fuelinstDelayNote(rows, new Date("2026-09-28T03:30:01.000Z"))).toBe(
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
    const view = buildNowBySourceView(rows, 24000);

    expect(view.rows.map((row) => row.fuel)).toEqual([
      "gas",
      "nuclear",
      "wind",
      "biomass",
      "hydro",
      "other",
      "embedded_solar",
      "embedded_wind",
      "coal",
    ]);
    expect(view.rows[0]).toMatchObject({
      fuel: "gas",
      gwLabel: "7.6",
      demandPctLabel: "31.5%",
    });
    expect(view.rows.find((row) => row.fuel === "embedded_solar")).toMatchObject({
      gwLabel: "0.0",
      missingNote: null,
    });
    expect(view.rows.find((row) => row.fuel === "embedded_wind")).toMatchObject({
      gwLabel: "—",
      demandPctLabel: "—",
      missingNote: "no data since 05:00 BST",
    });
    expect(view.rows.find((row) => row.fuel === "coal")).toMatchObject({
      gwLabel: "—",
      demandPctLabel: "—",
      missingNote: "no data",
    });
    expect(view.totalGwLabel).toBe("19.3");
    expect(view.stacked.map((segment) => segment.fuel)).toEqual([
      "gas",
      "nuclear",
      "wind",
      "biomass",
      "hydro",
      "other",
    ]);
    expect(view.stacked.reduce((sum, segment) => sum + segment.pct, 0)).toBeCloseTo(100, 5);
  });

  it("excludes interconnectors from the list total", () => {
    const view = buildNowBySourceView(rows, 24000);
    expect(view.rows.find((row) => row.fuel === "imports")).toBeUndefined();
    expect(view.totalMw).toBe(19298);
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
      gapBaseGw: 20,
      importGw: 4,
      exportGw: 0,
      embeddedMissing: [],
    });
    expect(points[1]).toEqual({
      time: "2026-09-28 07:30:00",
      demandGw: 18,
      generationGw: 22,
      gapBaseGw: 18,
      importGw: 0,
      exportGw: 4,
      embeddedMissing: [],
    });
    expect(points[2]).toEqual({
      time: "2026-09-28 08:00:00",
      demandGw: null,
      generationGw: 21,
      gapBaseGw: null,
      importGw: null,
      exportGw: null,
      embeddedMissing: ["embedded_wind"],
    });
  });

  it("uses round GW ticks and 24h ticks every three hours", () => {
    expect(gwAxisTicks(37.4)).toEqual([0, 10, 20, 30, 40]);

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
});

function emptyPoint() {
  return {
    time: "2026-09-28 07:00:00",
    demandGw: null,
    generationGw: null,
    gapBaseGw: null,
    importGw: null,
    exportGw: null,
    embeddedMissing: [],
  };
}
