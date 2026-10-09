import { describe, expect, it } from "vitest";
import type { EnergySnapshot, Generation5min } from "@/lib/types";
import {
  buildDemandBalanceSeries,
  buildGenerationStackSeries,
  buildHeadlineMetrics,
  buildRangeSummary,
  formatHeadlinePeriod,
  formatSettlementWindow,
  headlineAsOf,
  latestSnapshotWithField,
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

  it("keeps the latest reading per fuel so older embedded generation still counts", () => {
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
        timestamp: "2026-03-18 09:30:00",
        fuel_type: "embedded_wind",
        generation_mw: 900,
        source: "neso",
      },
      {
        timestamp: "2026-03-18 09:30:00",
        fuel_type: "embedded_solar",
        generation_mw: 4200,
        source: "pvlive",
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
          timestamp: "2026-03-18 09:30:00",
          fuel_type: "embedded_wind",
          generation_mw: 900,
          source: "neso",
        },
        {
          timestamp: "2026-03-18 09:30:00",
          fuel_type: "embedded_solar",
          generation_mw: 4200,
          source: "pvlive",
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
      totalGenerationMw: 23100,
      netTransfersMw: 300,
    });
  });

  it("does not take a later embedded-only timestamp as the latest snapshot", () => {
    const split = splitLatestGenerationRows([
      {
        timestamp: "2026-09-28 03:00:00",
        fuel_type: "ccgt",
        generation_mw: 7563,
        source: "fuelinst",
      },
      {
        timestamp: "2026-09-28 03:00:00",
        fuel_type: "wind",
        generation_mw: 3746,
        source: "fuelinst",
      },
      {
        timestamp: "2026-09-28 03:00:00",
        fuel_type: "embedded_wind",
        generation_mw: 917,
        source: "neso",
      },
      {
        timestamp: "2026-09-28 05:00:00",
        fuel_type: "embedded_wind",
        generation_mw: 817,
        source: "neso",
      },
      {
        timestamp: "2026-09-28 05:00:00",
        fuel_type: "embedded_solar",
        generation_mw: 0,
        source: "pvlive",
      },
    ]);

    expect(split.latestTimestamp).toBe("2026-09-28 03:00:00");
    expect(split.sources.map((row) => row.fuel_type).sort()).toEqual([
      "ccgt",
      "embedded_wind",
      "wind",
    ]);
    expect(split.sources.find((row) => row.fuel_type === "embedded_wind")?.generation_mw).toBe(
      917
    );
    expect(split.totalGenerationMw).toBe(12226);
  });

  it("joins embedded rows that land within 30 minutes after the fuelinst frame", () => {
    const split = splitLatestGenerationRows([
      {
        timestamp: "2026-09-28 04:50:00",
        fuel_type: "nuclear",
        generation_mw: 4000,
        source: "fuelinst",
      },
      {
        timestamp: "2026-09-28 05:00:00",
        fuel_type: "embedded_wind",
        generation_mw: 800,
        source: "neso",
      },
    ]);

    expect(split.latestTimestamp).toBe("2026-09-28 04:50:00");
    expect(split.sources.find((row) => row.fuel_type === "embedded_wind")?.generation_mw).toBe(
      800
    );
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
    expect(series[0]).not.toHaveProperty("solar");
    expect(series[1]).not.toHaveProperty("solar");
  });

  it("drops stack buckets that only contain embedded rows", () => {
    const series = buildGenerationStackSeries(
      [
        {
          timestamp: "2026-03-18 17:00:00",
          fuel_type: "embedded_solar",
          generation_mw: 1200,
          source: "pvlive",
        },
        {
          timestamp: "2026-03-18 16:30:00",
          fuel_type: "ccgt",
          generation_mw: 80,
          source: "fuelinst",
        },
      ],
      "24h"
    );

    expect(series).toHaveLength(1);
    expect(series[0]?.time).toBe(new Date("2026-03-18T16:30:00.000Z").getTime());
    expect(series[0]?.gas).toBe(100);
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

  it("ignores null prices when averaging so missing values do not become zeros", () => {
    const summary = buildRangeSummary([
      makeSnapshot({ timestamp: "2026-03-18 08:00:00", price_gbp_mwh: 60 }),
      makeSnapshot({ timestamp: "2026-03-18 08:30:00", price_gbp_mwh: null }),
      makeSnapshot({ timestamp: "2026-03-18 09:00:00", price_gbp_mwh: -13 }),
    ]);

    expect(summary.price).toEqual({
      latest: -13,
      average: 24,
      min: -13,
      max: 60,
      deltaFromAverage: -37,
    });
  });

  it("reads each headline KPI from the newest row that actually has that field", () => {
    const snapshots = [
      makeSnapshot({
        timestamp: "2026-09-27 11:00:00",
        carbon_intensity: 72,
        carbon_index: "low",
        demand_mw: 24800,
        price_gbp_mwh: 52.8,
        gen_gas_pct: 28,
      }),
      makeSnapshot({
        timestamp: "2026-09-27 11:30:00",
        carbon_intensity: 81,
        carbon_index: "moderate",
        demand_mw: 26510,
        price_gbp_mwh: null,
        gen_gas_pct: null,
        gen_coal_pct: null,
        gen_nuclear_pct: null,
        gen_wind_pct: null,
        gen_solar_pct: null,
        gen_hydro_pct: null,
        gen_biomass_pct: null,
        gen_imports_pct: null,
        gen_other_pct: null,
      }),
    ];

    const headline = buildHeadlineMetrics(snapshots);

    expect(headline.referenceTimestamp).toBe("2026-09-27 11:30:00");
    expect(headline.demand).toEqual({
      value: 26510,
      timestamp: "2026-09-27 11:30:00",
    });
    expect(headline.carbon).toEqual({
      value: 81,
      timestamp: "2026-09-27 11:30:00",
      index: "moderate",
    });
    expect(headline.price).toEqual({
      value: 52.8,
      timestamp: "2026-09-27 11:00:00",
    });
    expect(headline.mixSnapshot?.timestamp).toBe("2026-09-27 11:00:00");
    expect(headlineAsOf(headline.price.timestamp, headline.referenceTimestamp)).toBe(
      "12:00–12:30 BST"
    );
    expect(headlineAsOf(headline.demand.timestamp, headline.referenceTimestamp)).toBeNull();
    expect(headlineAsOf(headline.carbon.timestamp, headline.referenceTimestamp)).toBeNull();
    expect(headlineAsOf(headline.mixSnapshot?.timestamp ?? null, headline.referenceTimestamp)).toBe(
      "12:00–12:30 BST"
    );
  });

  it("keeps zero and negative prices as present values, not missing ones", () => {
    const snapshots = [
      makeSnapshot({ timestamp: "2026-09-27 10:30:00", price_gbp_mwh: 40 }),
      makeSnapshot({ timestamp: "2026-09-27 11:00:00", price_gbp_mwh: 0 }),
      makeSnapshot({ timestamp: "2026-09-27 11:30:00", price_gbp_mwh: -8.4 }),
    ];

    expect(latestSnapshotWithField(snapshots, "price_gbp_mwh")?.price_gbp_mwh).toBe(-8.4);

    const unordered = [
      makeSnapshot({ timestamp: "2026-09-27 11:30:00", price_gbp_mwh: null, demand_mw: 20000 }),
      makeSnapshot({ timestamp: "2026-09-27 11:00:00", price_gbp_mwh: 0, demand_mw: null }),
    ];
    expect(latestSnapshotWithField(unordered, "price_gbp_mwh")?.price_gbp_mwh).toBe(0);
    expect(latestSnapshotWithField(unordered, "demand_mw")?.demand_mw).toBe(20000);
  });

  it("returns empty headline metrics when every snapshot field is null", () => {
    expect(
      buildHeadlineMetrics([
        makeSnapshot({
          timestamp: "2026-09-27 11:30:00",
          carbon_intensity: null,
          demand_mw: null,
          price_gbp_mwh: null,
          gen_gas_pct: null,
          gen_coal_pct: null,
          gen_nuclear_pct: null,
          gen_wind_pct: null,
          gen_solar_pct: null,
          gen_hydro_pct: null,
          gen_biomass_pct: null,
          gen_imports_pct: null,
          gen_other_pct: null,
        }),
      ])
    ).toEqual({
      referenceTimestamp: null,
      carbon: { value: null, timestamp: null, index: null },
      demand: { value: null, timestamp: null },
      price: { value: null, timestamp: null },
      mixSnapshot: null,
    });
  });

  it("formats UK settlement windows and only labels a KPI that lags the others", () => {
    expect(formatSettlementWindow("2026-09-27 11:00:00")).toBe("12:00–12:30 BST");
    expect(formatSettlementWindow("2026-01-15 12:00:00")).toBe("12:00–12:30 GMT");
    expect(headlineAsOf("2026-09-27 11:00:00", "2026-09-27 11:00:00")).toBeNull();
    expect(headlineAsOf(null, "2026-09-27 11:30:00")).toBeNull();
    expect(headlineAsOf("2026-09-27 11:00:00", "2026-09-27T11:30:00Z")).toBe(
      "12:00–12:30 BST"
    );
  });

  it("never builds headline KPIs from daily or weekly aggregates", () => {
    const daily = [
      makeSnapshot({
        timestamp: "2026-09-26 00:00:00",
        demand_mw: 24000,
        price_gbp_mwh: 48,
      }),
    ];

    expect(buildHeadlineMetrics(daily, "day")).toEqual({
      referenceTimestamp: null,
      carbon: { value: null, timestamp: null, index: null },
      demand: { value: null, timestamp: null },
      price: { value: null, timestamp: null },
      mixSnapshot: null,
    });
    expect(buildHeadlineMetrics(daily, "week")).toEqual({
      referenceTimestamp: null,
      carbon: { value: null, timestamp: null, index: null },
      demand: { value: null, timestamp: null },
      price: { value: null, timestamp: null },
      mixSnapshot: null,
    });
    expect(headlineAsOf("2026-09-26 00:00:00", "2026-09-27 00:00:00", "day")).toBe(
      "26 Sep 2026"
    );
    expect(formatHeadlinePeriod("2026-09-26 00:00:00", "day")).toBe("26 Sep 2026");
    expect(formatHeadlinePeriod("2026-09-26 00:00:00", "week")).toBe("26 Sep 2026");
    expect(formatHeadlinePeriod("2026-09-26 00:00:00")).toBe("01:00–01:30 BST");
  });

  it("labels the 46-period spring-forward gap with both zones", () => {
    expect(formatSettlementWindow("2026-03-29 00:30:00")).toBe(
      "00:30 GMT–02:00 BST"
    );
    expect(formatSettlementWindow("2026-03-29 00:00:00")).toBe(
      "00:00–00:30 GMT"
    );
    expect(formatSettlementWindow("2026-03-29 01:00:00")).toBe(
      "02:00–02:30 BST"
    );
  });

  it("labels the 50-period fall-back overlap with the correct zone", () => {
    expect(formatSettlementWindow("2026-10-25 00:00:00")).toBe(
      "01:00–01:30 BST"
    );
    expect(formatSettlementWindow("2026-10-25 00:30:00")).toBe(
      "01:30 BST–01:00 GMT"
    );
    expect(formatSettlementWindow("2026-10-25 01:00:00")).toBe(
      "01:00–01:30 GMT"
    );
    expect(formatSettlementWindow("2026-10-25 01:30:00")).toBe(
      "01:30–02:00 GMT"
    );
  });

  it("puts demand on the same embedded-inclusive basis as generation", () => {
    const series = buildDemandBalanceSeries(
      [makeSnapshot({ timestamp: "2026-10-01 12:00:00", demand_mw: 24000 })],
      [
        {
          timestamp: "2026-10-01 12:00:00",
          fuel_type: "ccgt",
          generation_mw: 8000,
          source: "fuelinst",
        },
        {
          timestamp: "2026-10-01 12:00:00",
          fuel_type: "wind",
          generation_mw: 6000,
          source: "fuelinst",
        },
        {
          timestamp: "2026-10-01 12:00:00",
          fuel_type: "embedded_wind",
          generation_mw: 4000,
          source: "neso",
        },
        {
          timestamp: "2026-10-01 12:00:00",
          fuel_type: "embedded_solar",
          generation_mw: 3000,
          source: "pvlive",
        },
      ],
      "24h"
    );

    expect(series[0]?.demandMw).toBe(31_000);
    expect(series[0]?.domesticGenerationMw).toBe(21_000);
    expect(series[0]?.embeddedMissing).toEqual([]);
  });
});
