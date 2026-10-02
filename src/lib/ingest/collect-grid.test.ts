import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectRecentSnapshots,
  collectSnapshotsForSettlementDate,
  elexonPublishWindow,
  ELEXON_PUBLISH_LAG_MS,
  generationMwByPeriod,
  generationMwWithinPlausibleMaxima,
  snapshotCollectionFromSources,
  snapshotRowReadyToIngest,
} from "@/lib/ingest/collect-grid";
import { listRecentSettlementPeriods } from "@/lib/settlement-period";
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
          generationmix: [{ fuel: "wind", perc: 40 }],
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
        {
          startTime: "2026-09-27T09:30:00Z",
          settlementDate: "2026-09-27",
          settlementPeriod: 21,
          psrType: "Wind Onshore",
          quantity: 4500,
        },
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
    expect(latest?.demand_mw).toBe(28000);
    expect(latest?.carbon_intensity).toBe(120);
    expect(latest?.gen_wind_mw).toBe(4500);
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

describe("snapshotRowReadyToIngest", () => {
  it("requires numeric demand and at least one numeric gen_*_mw", () => {
    expect(
      snapshotRowReadyToIngest({
        demand_mw: 28_000,
        gen_wind_mw: 4500,
      })
    ).toBe(true);
    expect(snapshotRowReadyToIngest({ demand_mw: 28_000 })).toBe(false);
    expect(snapshotRowReadyToIngest({ gen_wind_mw: 4500 })).toBe(false);
    expect(
      snapshotRowReadyToIngest({
        demand_mw: null,
        gen_wind_mw: 4500,
      })
    ).toBe(false);
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
    const carbon = urls.find((url) => url.includes("carbonintensity.org.uk/intensity"));

    expect(itsdo).toContain("publishDateTimeFrom=2026-09-26T23:00:00.000Z");
    expect(itsdo).toContain("publishDateTimeTo=2026-09-28T03:30:00.000Z");
    expect(agptUrl).toContain("publishDateTimeFrom=2026-09-26T23:00:00.000Z");
    expect(agptUrl).toContain("publishDateTimeTo=2026-09-28T03:30:00.000Z");
    expect(carbon).toContain("2026-09-26T23:00:00Z");
    expect(carbon).not.toContain("2026-09-28T03:30:00");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.timestamp).toBe("2026-09-27 09:30:00");
    expect(result.rows[0]?.demand_mw).toBe(28_000);
    expect(result.rows[0]?.gen_wind_mw).toBe(4500);
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

    expect(result.sources.every((source) => source.ok)).toBe(true);
    expect(result.rows).toEqual([]);
  });
});
