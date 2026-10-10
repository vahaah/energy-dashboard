import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectRecentSnapshots,
  collectSnapshotsForSettlementDate,
  elexonPublishWindow,
  ELEXON_PUBLISH_LAG_MS,
  generationMwByPeriod,
  generationMwWithinPlausibleMaxima,
  groupGenerationMwByPeriod,
  snapshotCollectionFromSources,
  snapshotRowReadyToIngest,
  withSettlementDateCoverage,
} from "@/lib/ingest/collect-grid";
import { SNAPSHOT_FUELS, SNAPSHOT_MIX_FUELS } from "@/lib/ingest/fuels";
import { listRecentSettlementPeriods, listSettlementPeriods } from "@/lib/settlement-period";
import type { ElexonGeneration } from "@/lib/types";

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  };
}

function httpError(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
  };
}

function mockFetchByUrl(handler: (url: string) => { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => handler(String(input))));
}

function successfulSourcePayloads(url: string) {
  if (url.includes("carbonintensity.org.uk/intensity")) {
    return jsonResponse({
      data: [
        {
          from: "2026-09-27T09:30Z",
          to: "2026-09-27T10:00Z",
          intensity: { actual: 120, forecast: 110, index: "moderate" },
        },
      ],
    });
  }
  if (url.includes("carbonintensity.org.uk/generation")) {
    return jsonResponse({
      data: [
        {
          from: "2026-09-27T09:30Z",
          to: "2026-09-27T10:00Z",
          generationmix: [
            { fuel: "gas", perc: 30 },
            { fuel: "coal", perc: 0 },
            { fuel: "nuclear", perc: 15 },
            { fuel: "wind", perc: 40 },
            { fuel: "solar", perc: 2 },
            { fuel: "hydro", perc: 3 },
            { fuel: "biomass", perc: 5 },
            { fuel: "imports", perc: 5 },
            { fuel: "other", perc: 0 },
          ],
        },
      ],
    });
  }
  if (url.includes("system-prices")) {
    return jsonResponse({
      data: [
        {
          settlementDate: "2026-09-27",
          settlementPeriod: 21,
          startTime: "2026-09-27T09:30:00Z",
          systemSellPrice: 40,
          systemBuyPrice: 42.5,
        },
      ],
    });
  }
  if (url.includes("market-index")) {
    return jsonResponse({
      data: [
        {
          startTime: "2026-09-27T09:30:00Z",
          dataProvider: "APXMIDP",
          settlementDate: "2026-09-27",
          settlementPeriod: 21,
          price: 68.4,
          volume: 1840.5,
        },
      ],
    });
  }
  if (url.includes("datasets/ITSDO")) {
    return jsonResponse({
      data: [
        {
          startTime: "2026-09-27T09:30:00Z",
          settlementDate: "2026-09-27",
          settlementPeriod: 21,
          demand: 28000,
        },
      ],
    });
  }
  if (url.includes("datasets/AGPT")) {
    return jsonResponse({
      data: [
        { startTime: "2026-09-27T09:30:00Z", psrType: "Fossil Gas", quantity: 8000 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Fossil Hard coal", quantity: 0 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Nuclear", quantity: 3000 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Wind Onshore", quantity: 4500 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Solar", quantity: 200 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Hydro Run-of-river and poundage", quantity: 400 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Hydro Pumped Storage", quantity: 180 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Biomass", quantity: 600 },
        { startTime: "2026-09-27T09:30:00Z", psrType: "Other", quantity: 100 },
      ],
    });
  }
  return httpError(404);
}

describe("snapshot ingest refuses incomplete overwrites", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not emit snapshot rows when any required source fetch fails", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("carbonintensity.org.uk")) {
        return httpError(503);
      }
      return successfulSourcePayloads(url);
    });

    const result = await collectRecentSnapshots(new Date("2026-09-27T10:08:00.000Z"));

    expect(result.rows).toEqual([]);
    expect(result.sources.some((source) => source.source === "carbon_intensity" && !source.ok)).toBe(
      true
    );
    expect(result.sources.some((source) => source.source === "demand" && source.ok)).toBe(true);
  });

  it("ingests complete rows only after every source fetch succeeds", async () => {
    mockFetchByUrl(successfulSourcePayloads);

    const result = await collectRecentSnapshots(new Date("2026-09-27T10:08:00.000Z"));
    const latest = result.rows.find((row) => row.timestamp === "2026-09-27 09:30:00");

    expect(result.sources.every((source) => source.ok)).toBe(true);
    expect(latest).toBeDefined();
    expect(latest?.price_gbp_mwh).toBe(42.5);
    expect(latest?.price_mid_gbp_mwh).toBe(68.4);
    expect(latest?.mid_volume_mwh).toBe(1840.5);
    expect(latest?.gen_pumped_mw).toBe(180);
    expect(latest?.gen_hydro_mw).toBe(400);
    expect(latest?.demand_mw).toBe(28000);
    expect(latest?.carbon_intensity).toBe(120);
    expect(latest?.gen_wind_mw).toBe(4500);
  });

  it("does not replace snapshots when Market Index returns an empty window", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("market-index")) {
        return jsonResponse({ data: [] });
      }
      return successfulSourcePayloads(url);
    });

    const result = await collectRecentSnapshots(new Date("2026-09-27T10:08:00.000Z"));

    expect(result.rows).toEqual([]);
    expect(result.sources.some((source) => source.source === "market_index" && !source.ok)).toBe(
      true
    );
  });

  it("treats Market Index half-hours with zero volume or £0 as missing", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("market-index")) {
        return jsonResponse({
          data: [
            {
              startTime: "2026-09-27T09:30:00Z",
              dataProvider: "APXMIDP",
              settlementDate: "2026-09-27",
              settlementPeriod: 21,
              price: 0,
              volume: 0,
            },
          ],
        });
      }
      return successfulSourcePayloads(url);
    });

    const result = await collectRecentSnapshots(new Date("2026-09-27T10:08:00.000Z"));
    const latest = result.rows.find((row) => row.timestamp === "2026-09-27 09:30:00");

    expect(latest?.price_gbp_mwh).toBe(42.5);
    expect(latest?.price_mid_gbp_mwh).toBeNull();
    expect(latest?.mid_volume_mwh).toBeNull();
  });

  it("omits a recent period when AGPT exceeds GB maxima so hourly cron cannot write null MW", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("datasets/AGPT")) {
        return jsonResponse({
          data: [
            { startTime: "2026-09-27T09:30:00Z", psrType: "Wind Onshore", quantity: 32_302 },
            { startTime: "2026-09-27T09:30:00Z", psrType: "Fossil Gas", quantity: 8000 },
            { startTime: "2026-09-27T09:30:00Z", psrType: "Nuclear", quantity: 3000 },
          ],
        });
      }
      return successfulSourcePayloads(url);
    });

    const result = await collectRecentSnapshots(new Date("2026-09-27T10:08:00.000Z"));

    expect(result.sources.every((source) => source.ok)).toBe(true);
    expect(result.rows.some((row) => row.timestamp === "2026-09-27 09:30:00")).toBe(false);
  });

  it("drops a built batch when a source status is failed so ReplacingMergeTree cannot clobber", () => {
    const periods = listRecentSettlementPeriods(
      new Date("2026-09-27T10:08:00.000Z"),
      30 * 60 * 1000
    );
    const result = snapshotCollectionFromSources(
      periods,
      {
        intensityByTime: new Map(),
        mixByTime: new Map(),
        priceByTime: new Map([["2026-09-27 09:30:00", 42.5]]),
        demandByTime: new Map(),
        genMwByTime: new Map(),
      },
      [
        { source: "carbon_intensity", ok: false, error: "HTTP 503" },
        { source: "prices", ok: true, rows: 1 },
      ]
    );

    expect(result.rows).toEqual([]);
    expect(result.sources[0]?.ok).toBe(false);
  });
});

function agpt(
  overrides: Pick<ElexonGeneration, "psrType" | "quantity" | "startTime"> &
    Partial<ElexonGeneration>
): ElexonGeneration {
  return {
    dataset: "AGPT",
    publishTime: "2026-07-02T12:59:01Z",
    businessType: "Production",
    settlementDate: "2026-07-02",
    settlementPeriod: 27,
    ...overrides,
  };
}

describe("AGPT generation de-duplication", () => {
  it("keeps one row per period and psrType before summing onshore and offshore wind", () => {
    const byTime = generationMwByPeriod([
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Onshore",
        quantity: 7778,
      }),
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Offshore",
        quantity: 8373,
      }),
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Solar",
        quantity: 12926,
      }),
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Onshore",
        quantity: 7778,
      }),
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Offshore",
        quantity: 8373,
      }),
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Solar",
        quantity: 12926,
      }),
    ]);

    expect(byTime.get("2026-07-02 12:00:00")).toEqual({
      wind: 16_151,
      solar: 12_926,
    });
  });

  it("drops a combined Wind row when onshore and offshore are already present", () => {
    const byTime = generationMwByPeriod([
      agpt({
        startTime: "2025-11-18T12:30:00Z",
        psrType: "Wind",
        quantity: 16_151,
      }),
      agpt({
        startTime: "2025-11-18T12:30:00Z",
        psrType: "Wind Onshore",
        quantity: 7_778,
      }),
      agpt({
        startTime: "2025-11-18T12:30:00Z",
        psrType: "Wind Offshore",
        quantity: 8_373,
      }),
    ]);

    expect(byTime.get("2025-11-18 12:30:00")?.wind).toBe(16_151);
  });

  it("keeps Hydro Pumped Storage out of hydro", () => {
    const byTime = generationMwByPeriod([
      agpt({
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Hydro Run-of-river and poundage",
        quantity: 400,
      }),
      agpt({
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Hydro Pumped Storage",
        quantity: 180,
      }),
    ]);

    expect(byTime.get("2026-07-02 12:00:00")).toEqual({
      hydro: 400,
      pumped: 180,
    });
  });

  it("prefers the later publishTime when Elexon revises a period", () => {
    const byTime = generationMwByPeriod([
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Onshore",
        quantity: 7000,
      }),
      agpt({
        publishTime: "2026-07-02T13:10:00Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Onshore",
        quantity: 7778,
      }),
      agpt({
        publishTime: "2026-07-02T13:10:00Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Offshore",
        quantity: 8373,
      }),
    ]);

    expect(byTime.get("2026-07-02 12:00:00")?.wind).toBe(16_151);
  });

  it("drops a half-hour that exceeds plausible GB maxima instead of storing doubled MW", () => {
    const doubled = {
      wind: 32_302,
      solar: 25_852,
      gas: 7734,
      nuclear: 6014,
    };

    expect(generationMwWithinPlausibleMaxima(doubled)).toBe(false);
    expect(
      generationMwWithinPlausibleMaxima({
        wind: 16_151,
        solar: 12_926,
        gas: 3867,
        nuclear: 3007,
      })
    ).toBe(true);

    const byTime = generationMwByPeriod([
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Onshore",
        quantity: 32_302,
      }),
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Solar",
        quantity: 12_926,
      }),
    ]);

    expect(byTime.has("2026-07-02 12:00:00")).toBe(false);
  });

  it("skips the whole snapshot when maxima reject generation so hourly ingest cannot write null MW", () => {
    const grouped = groupGenerationMwByPeriod([
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Wind Onshore",
        quantity: 32_302,
      }),
      agpt({
        publishTime: "2026-07-02T12:59:01Z",
        startTime: "2026-07-02T12:00:00Z",
        psrType: "Solar",
        quantity: 12_926,
      }),
    ]);

    expect(grouped.rejectedTimes.has("2026-07-02 12:00:00")).toBe(true);

    const periods = listSettlementPeriods("2026-07-02");
    const result = snapshotCollectionFromSources(
      periods,
      {
        intensityByTime: new Map(),
        mixByTime: new Map(),
        priceByTime: new Map([["2026-07-02 12:00:00", 42.5]]),
        demandByTime: new Map([["2026-07-02 12:00:00", 28_000]]),
        genMwByTime: grouped.byTime,
        rejectedGenTimes: grouped.rejectedTimes,
      },
      [
        { source: "carbon_intensity", ok: true, rows: 1 },
        { source: "generation_mw", ok: true, rows: 1 },
      ]
    );

    expect(result.rows.some((row) => row.timestamp === "2026-07-02 12:00:00")).toBe(false);
    expect(result.rows).toHaveLength(periods.length - 1);
  });

  it("rejects a 2× total that still sits under per-fuel maxima", () => {
    const periods = listSettlementPeriods("2025-11-18");
    const result = snapshotCollectionFromSources(
      periods,
      {
        intensityByTime: new Map(),
        mixByTime: new Map(),
        priceByTime: new Map([["2025-11-18 12:30:00", 42.5]]),
        demandByTime: new Map([["2025-11-18 12:30:00", 37_700]]),
        genMwByTime: new Map([
          [
            "2025-11-18 12:30:00",
            {
              gas: 20_000,
              coal: 0,
              nuclear: 8_000,
              wind: 24_000,
              solar: 16_000,
              hydro: 800,
              biomass: 4_000,
              other: 1_400,
              pumped: 400,
            },
          ],
        ]),
      },
      [{ source: "generation_mw", ok: true, rows: 1 }]
    );

    expect(result.rows.some((row) => row.timestamp === "2025-11-18 12:30:00")).toBe(false);
    expect(result.integrity?.failing.some((finding) => finding.timestamp === "2025-11-18 12:30:00")).toBe(
      true
    );
  });
});

describe("elexonPublishWindow", () => {
  it("extends publishDateTimeTo by 6 hours so late ITSDO/AGPT publishes are included", () => {
    expect(ELEXON_PUBLISH_LAG_MS).toBe(6 * 60 * 60 * 1000);

    const window = elexonPublishWindow(
      new Date("2026-09-26T23:00:00.000Z"),
      new Date("2026-09-27T23:00:00.000Z")
    );

    expect(window.fromIso).toBe("2026-09-26T23:00:00.000Z");
    expect(window.toIso).toBe("2026-09-28T05:00:00.000Z");
  });

  it("caps the lag at now so a 03:30 heal does not query the future", () => {
    const window = elexonPublishWindow(
      new Date("2026-09-26T23:00:00.000Z"),
      new Date("2026-09-27T23:00:00.000Z"),
      new Date("2026-09-28T03:30:00.000Z")
    );

    expect(window.toIso).toBe("2026-09-28T03:30:00.000Z");
  });

  it("does not extend past the 6 hour lag even when now is later", () => {
    const window = elexonPublishWindow(
      new Date("2026-09-26T23:00:00.000Z"),
      new Date("2026-09-27T23:00:00.000Z"),
      new Date("2026-09-29T12:00:00.000Z")
    );

    expect(window.toIso).toBe("2026-09-28T05:00:00.000Z");
  });
});

function completeHistoricalSnapshot(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    demand_mw: 28_000,
    price_gbp_mwh: 42.5,
    carbon_intensity: 120,
  };
  for (const fuel of SNAPSHOT_MIX_FUELS) {
    row[`gen_${fuel}_pct`] = fuel === "wind" ? 40 : 0;
  }
  for (const fuel of SNAPSHOT_FUELS) {
    row[`gen_${fuel}_mw`] = fuel === "wind" ? 4500 : 0;
  }
  return { ...row, ...overrides };
}

describe("snapshotRowReadyToIngest", () => {
  it("requires demand, price, carbon, mix, and every gen_*_mw before a historical rewrite", () => {
    expect(snapshotRowReadyToIngest(completeHistoricalSnapshot())).toBe(true);
    expect(
      snapshotRowReadyToIngest(
        completeHistoricalSnapshot({
          demand_mw: 28_000,
          gen_wind_mw: 4500,
          price_gbp_mwh: undefined,
          carbon_intensity: undefined,
        })
      )
    ).toBe(false);
    expect(snapshotRowReadyToIngest({ demand_mw: 28_000, gen_wind_mw: 4500 })).toBe(false);
    expect(snapshotRowReadyToIngest(completeHistoricalSnapshot({ price_gbp_mwh: null }))).toBe(
      false
    );
    expect(snapshotRowReadyToIngest(completeHistoricalSnapshot({ carbon_intensity: null }))).toBe(
      false
    );
    expect(snapshotRowReadyToIngest(completeHistoricalSnapshot({ gen_gas_pct: null }))).toBe(false);
    expect(snapshotRowReadyToIngest(completeHistoricalSnapshot({ gen_gas_mw: null }))).toBe(false);
    expect(
      snapshotRowReadyToIngest(
        completeHistoricalSnapshot({
          price_mid_gbp_mwh: null,
          mid_volume_mwh: null,
          gen_pumped_mw: null,
          gen_battery_mw: null,
        })
      )
    ).toBe(true);
  });
});

describe("settlement-date snapshot collection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queries ITSDO/AGPT with a 6h publish lag and drops periods missing demand or generation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      successfulSourcePayloads(String(input))
    );
    vi.stubGlobal("fetch", fetchMock);

    const now = new Date("2026-09-28T03:30:00.000Z");
    const result = await collectSnapshotsForSettlementDate("2026-09-27", now);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    const itsdo = urls.find((url) => url.includes("datasets/ITSDO"));
    const agptUrl = urls.find((url) => url.includes("datasets/AGPT"));
    const midUrl = urls.find((url) => url.includes("market-index"));
    const carbon = urls.find((url) => url.includes("carbonintensity.org.uk/intensity"));

    expect(itsdo).toContain("publishDateTimeFrom=2026-09-26T23:00:00.000Z");
    expect(itsdo).toContain("publishDateTimeTo=2026-09-28T03:30:00.000Z");
    expect(agptUrl).toContain("publishDateTimeFrom=2026-09-26T23:00:00.000Z");
    expect(agptUrl).toContain("publishDateTimeTo=2026-09-28T03:30:00.000Z");
    expect(midUrl).toContain("dataProviders=APXMIDP");
    expect(midUrl).toContain("from=2026-09-26T23:00:00Z");
    expect(carbon).toContain("2026-09-26T23:00:00Z");
    expect(carbon).not.toContain("2026-09-28T03:30:00");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.timestamp).toBe("2026-09-27 09:30:00");
    expect(result.rows[0]?.demand_mw).toBe(28_000);
    expect(result.rows[0]?.price_gbp_mwh).toBe(42.5);
    expect(result.rows[0]?.carbon_intensity).toBe(120);
    expect(result.rows[0]?.gen_wind_mw).toBe(4500);
    expect(result.rows[0]?.gen_gas_mw).toBe(8000);
    expect(
      result.sources.some((source) => source.source === "snapshot_coverage" && !source.ok)
    ).toBe(true);
  });

  it("rejects a period whose carbon mix omitted fuels so gen_*_pct would be null", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("carbonintensity.org.uk/generation")) {
        return jsonResponse({
          data: [
            {
              from: "2026-09-27T09:30Z",
              to: "2026-09-27T10:00Z",
              generationmix: [{ fuel: "wind", perc: 40 }],
            },
          ],
        });
      }
      return successfulSourcePayloads(url);
    });

    const result = await collectSnapshotsForSettlementDate(
      "2026-09-27",
      new Date("2026-09-28T06:30:00.000Z")
    );

    expect(result.rows).toEqual([]);
    expect(
      result.sources.some((source) => source.source === "snapshot_coverage" && !source.ok)
    ).toBe(true);
  });

  it("rejects a period where AGPT returned only wind so other gen_*_mw would be null", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("datasets/AGPT")) {
        return jsonResponse({
          data: [
            {
              startTime: "2026-09-27T09:30:00Z",
              psrType: "Wind Onshore",
              quantity: 4500,
            },
          ],
        });
      }
      return successfulSourcePayloads(url);
    });

    const result = await collectSnapshotsForSettlementDate(
      "2026-09-27",
      new Date("2026-09-28T03:30:00.000Z")
    );

    expect(result.rows).toEqual([]);
    expect(
      result.sources.some((source) => source.source === "snapshot_coverage" && !source.ok)
    ).toBe(true);
  });

  it("does not emit null demand/generation rows that would clobber complete ReplacingMergeTree values", async () => {
    mockFetchByUrl((url) => {
      if (url.includes("datasets/ITSDO") || url.includes("datasets/AGPT")) {
        return jsonResponse({ data: [] });
      }
      return successfulSourcePayloads(url);
    });

    const result = await collectSnapshotsForSettlementDate(
      "2026-09-27",
      new Date("2026-09-28T03:30:00.000Z")
    );

    expect(result.rows).toEqual([]);
    expect(
      result.sources.some((source) => source.source === "snapshot_coverage" && !source.ok)
    ).toBe(true);
  });
});

describe("withSettlementDateCoverage", () => {
  it("fails the heal when fewer than the expected settlement periods are ready", () => {
    const result = withSettlementDateCoverage(
      {
        rows: [completeHistoricalSnapshot()],
        sources: [{ source: "demand", ok: true, rows: 1 }],
      },
      48
    );

    expect(result.rows).toHaveLength(1);
    expect(result.sources).toContainEqual({
      source: "snapshot_coverage",
      ok: false,
      rows: 1,
      error: "incomplete settlement-date coverage: 1 of 48 periods ready",
    });
  });

  it("keeps sources ok when every settlement period is ready", () => {
    const rows = Array.from({ length: 48 }, () => completeHistoricalSnapshot());
    const result = withSettlementDateCoverage(
      {
        rows,
        sources: [{ source: "demand", ok: true, rows: 48 }],
      },
      48
    );

    expect(result.rows).toHaveLength(48);
    expect(result.sources.every((source) => source.ok)).toBe(true);
  });

  it("does not hide an upstream source failure behind a coverage status", () => {
    const result = withSettlementDateCoverage(
      {
        rows: [],
        sources: [{ source: "demand", ok: false, error: "HTTP 503" }],
      },
      48
    );

    expect(result.sources.map((source) => source.source)).toEqual(["demand"]);
  });
});

describe("settlement price cache policy", () => {
  it("does not treat a just-ended settlement date as historical", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/ingest/collect-grid.ts"), "utf8");
    expect(source).toContain("policyForSettlementPrices(settlementDate, now)");
    expect(source).not.toContain("policyForExternalWindow(`${settlementDate}T23:59:59.000Z`)");
  });
});
