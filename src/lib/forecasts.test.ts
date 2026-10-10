import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CARBON_FORECAST_URL,
  NDF_URL,
  WINDFOR_URL,
  carbonForecastPoints,
  carbonForecastUrl,
  demandForecastPoints,
  emptyLookAhead,
  forecastCacheControl,
  forecastRequestInit,
  FORECAST_CACHE_KEY,
  FORECAST_REVALIDATE_SECONDS,
  formatGridFetchedAt,
  formatLookAheadWindow,
  greenestWindow,
  loadLookAhead,
  lookAheadFromRows,
  publicLookAhead,
  showsCarbonForecast,
  showsDemandForecast,
  showsLookAheadCopy,
  windLookAhead,
} from "@/lib/forecasts";
import type { CarbonIntensityResponse } from "@/lib/types";

type IntensityRow = CarbonIntensityResponse["data"][number];

const NOW = new Date("2026-10-10T12:00:00.000Z");

function carbonRow(from: string, to: string, forecast: number): IntensityRow {
  return {
    from,
    to,
    intensity: { forecast, actual: null, index: "low" },
  };
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  };
}

describe("forecast cache policy", () => {
  it("revalidates every 30 minutes on a fixed key so each upstream is hit at most 48 times a day", () => {
    expect(FORECAST_REVALIDATE_SECONDS).toBe(1_800);
    expect(forecastRequestInit().next).toEqual({
      revalidate: 1_800,
      tags: ["forecasts"],
    });
    expect(forecastCacheControl()).toBe("private, no-store");
    expect(readFileSync(resolve(import.meta.dirname, "./types.ts"), "utf8")).toContain(
      "export type LookAheadView"
    );
    const source = readFileSync(resolve(import.meta.dirname, "./forecasts.ts"), "utf8");
    expect(source).toContain(`"${FORECAST_CACHE_KEY}"`);
    expect(source).toContain("unstable_cache");
    expect(source).toContain("cachedForecastRows");
    expect(source).toContain("lookAheadFromRows(rows, new Date())");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("tinybird");
  });

  it("recomputes the greenest window from cached rows at request time", () => {
    const rows = {
      fetchedAt: "2026-10-10T12:10:00.000Z",
      carbonRows: [
        carbonRow("2026-10-10T12:30Z", "2026-10-10T13:00Z", 10),
        carbonRow("2026-10-10T13:00Z", "2026-10-10T13:30Z", 10),
        carbonRow("2026-10-10T13:30Z", "2026-10-10T14:00Z", 10),
        carbonRow("2026-10-10T14:00Z", "2026-10-10T14:30Z", 10),
        carbonRow("2026-10-10T14:30Z", "2026-10-10T15:00Z", 40),
        carbonRow("2026-10-10T15:00Z", "2026-10-10T15:30Z", 40),
        carbonRow("2026-10-10T15:30Z", "2026-10-10T16:00Z", 40),
        carbonRow("2026-10-10T16:00Z", "2026-10-10T16:30Z", 40),
      ],
      windRows: null,
      demandRows: null,
    };

    const atFetch = lookAheadFromRows(rows, new Date("2026-10-10T12:10:00.000Z"));
    expect(atFetch.greenest?.startUtc).toBe("2026-10-10T12:30Z");
    expect(atFetch.fetchedAt).toBe(rows.fetchedAt);

    const later = lookAheadFromRows(rows, new Date("2026-10-10T12:35:00.000Z"));
    expect(later.greenest?.startUtc).toBe("2026-10-10T13:00Z");
    expect(later.fetchedAt).toBe(rows.fetchedAt);
  });

  it("uses the dedicated fw48h, WINDFOR and NDF endpoints", () => {
    expect(carbonForecastUrl(NOW)).toBe(
      `${CARBON_FORECAST_URL}/2026-10-10T12:00:00Z/fw48h`
    );
    expect(WINDFOR_URL).toContain("/forecast/generation/wind");
    expect(NDF_URL).toContain("/forecast/demand/day-ahead");
  });
});

describe("greenest window", () => {
  it("picks the soonest 2-hour stretch with the lowest average forecast", () => {
    const rows = [
      carbonRow("2026-10-10T11:00Z", "2026-10-10T11:30Z", 10),
      carbonRow("2026-10-10T12:00Z", "2026-10-10T12:30Z", 80),
      carbonRow("2026-10-10T12:30Z", "2026-10-10T13:00Z", 70),
      carbonRow("2026-10-10T13:00Z", "2026-10-10T13:30Z", 40),
      carbonRow("2026-10-10T13:30Z", "2026-10-10T14:00Z", 42),
      carbonRow("2026-10-10T14:00Z", "2026-10-10T14:30Z", 44),
      carbonRow("2026-10-10T14:30Z", "2026-10-10T15:00Z", 46),
      carbonRow("2026-10-10T15:00Z", "2026-10-10T15:30Z", 90),
      carbonRow("2026-10-11T03:00Z", "2026-10-11T03:30Z", 90),
      carbonRow("2026-10-11T03:30Z", "2026-10-11T04:00Z", 90),
      carbonRow("2026-10-11T04:00Z", "2026-10-11T04:30Z", 90),
      carbonRow("2026-10-11T04:30Z", "2026-10-11T05:00Z", 90),
    ];

    const window = greenestWindow(rows, NOW);
    expect(window).toMatchObject({
      startUtc: "2026-10-10T13:00Z",
      endUtc: "2026-10-10T15:00Z",
      grams: 43,
    });
    expect(window?.sentence).toBe(
      "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g)."
    );
  });

  it("labels a tomorrow window and ignores periods that have already ended", () => {
    const rows = [
      carbonRow("2026-10-10T11:30Z", "2026-10-10T12:00Z", 5),
      carbonRow("2026-10-11T03:00Z", "2026-10-11T03:30Z", 22),
      carbonRow("2026-10-11T03:30Z", "2026-10-11T04:00Z", 22),
      carbonRow("2026-10-11T04:00Z", "2026-10-11T04:30Z", 24),
      carbonRow("2026-10-11T04:30Z", "2026-10-11T05:00Z", 24),
    ];
    const window = greenestWindow(rows, NOW);
    expect(window?.sentence).toContain("tomorrow 04:00–06:00 BST");
    expect(window?.grams).toBe(23);
  });

  it("only scores four contiguous half-hours and does not jump a gap", () => {
    const window = greenestWindow(
      [
        carbonRow("2026-10-10T12:00Z", "2026-10-10T12:30Z", 10),
        carbonRow("2026-10-10T12:30Z", "2026-10-10T13:00Z", 10),
        carbonRow("2026-10-10T13:00Z", "2026-10-10T13:30Z", 10),
        carbonRow("2026-10-10T15:00Z", "2026-10-10T15:30Z", 12),
        carbonRow("2026-10-10T15:30Z", "2026-10-10T16:00Z", 12),
        carbonRow("2026-10-10T16:00Z", "2026-10-10T16:30Z", 12),
        carbonRow("2026-10-10T16:30Z", "2026-10-10T17:00Z", 12),
      ],
      NOW
    );
    expect(window).toMatchObject({
      startUtc: "2026-10-10T15:00Z",
      endUtc: "2026-10-10T17:00Z",
      grams: 12,
    });
  });

  it("returns null when there is no future forecast", () => {
    expect(
      greenestWindow(
        [carbonRow("2026-10-10T10:00Z", "2026-10-10T10:30Z", 20)],
        NOW
      )
    ).toBeNull();
  });

  it("skips a half-hour that has already started so the recommended window is still ahead", () => {
    const midPeriod = new Date("2026-10-10T12:10:00.000Z");
    const window = greenestWindow(
      [
        carbonRow("2026-10-10T12:00Z", "2026-10-10T12:30Z", 10),
        carbonRow("2026-10-10T12:30Z", "2026-10-10T13:00Z", 10),
        carbonRow("2026-10-10T13:00Z", "2026-10-10T13:30Z", 10),
        carbonRow("2026-10-10T13:30Z", "2026-10-10T14:00Z", 10),
        carbonRow("2026-10-10T14:00Z", "2026-10-10T14:30Z", 40),
        carbonRow("2026-10-10T14:30Z", "2026-10-10T15:00Z", 40),
        carbonRow("2026-10-10T15:00Z", "2026-10-10T15:30Z", 40),
        carbonRow("2026-10-10T15:30Z", "2026-10-10T16:00Z", 40),
      ],
      midPeriod
    );
    expect(window).toMatchObject({
      startUtc: "2026-10-10T12:30Z",
      endUtc: "2026-10-10T14:30Z",
      grams: 18,
    });
  });
});

describe("wind tonight / tomorrow", () => {
  it("says wind falls when tomorrow evening is lower", () => {
    const lookAhead = windLookAhead(
      [
        { startTime: "2026-10-10T17:00:00Z", generation: 12_000 },
        { startTime: "2026-10-10T18:00:00Z", generation: 11_000 },
        { startTime: "2026-10-11T17:00:00Z", generation: 9_000 },
        { startTime: "2026-10-11T18:00:00Z", generation: 8_400 },
      ],
      NOW
    );
    expect(lookAhead?.tonightGw).toBe(11);
    expect(lookAhead?.tomorrowEveningGw).toBe(8.4);
    expect(lookAhead?.sentence).toBe(
      "Wind is forecast to fall to 8.4 GW by tomorrow evening."
    );
    expect(lookAhead?.basis).toContain("Transmission-connected");
    expect(lookAhead?.sparkline).toEqual([12, 11, 9, 8.4]);
  });

  it("says wind rises when tomorrow evening is higher", () => {
    const lookAhead = windLookAhead(
      [
        { startTime: "2026-10-10T18:00:00Z", generation: 6_000 },
        { startTime: "2026-10-11T18:00:00Z", generation: 9_200 },
      ],
      NOW
    );
    expect(lookAhead?.sentence).toBe(
      "Wind is forecast to rise to 9.2 GW by tomorrow evening."
    );
  });
});

describe("demand forecast points", () => {
  it("keeps national NDF from now on and drops other boundaries", () => {
    const points = demandForecastPoints(
      [
        { startTime: "2026-10-10T11:00:00Z", nationalDemand: 18_000, boundary: "N" },
        { startTime: "2026-10-10T12:30:00Z", nationalDemand: 19_500, boundary: "N" },
        { startTime: "2026-10-10T13:00:00Z", nationalDemand: 20_000, boundary: "Z1" },
        { startTime: "2026-10-10T13:30:00Z", nationalDemand: null, boundary: "N" },
      ],
      NOW
    );
    expect(points).toEqual([{ time: "2026-10-10 12:30:00", value: 19_500 }]);
  });
});

describe("carbon forecast points", () => {
  it("keeps future half-hours only", () => {
    expect(
      carbonForecastPoints(
        [
          carbonRow("2026-10-10T11:00Z", "2026-10-10T11:30Z", 40),
          carbonRow("2026-10-10T12:00Z", "2026-10-10T12:30Z", 28),
        ],
        NOW
      )
    ).toEqual([{ time: "2026-10-10 12:00:00", value: 28 }]);
  });
});

describe("look-ahead copy and public payload", () => {
  it("labels times as when Grid fetched them", () => {
    expect(formatGridFetchedAt("2026-10-10T12:00:00.000Z")).toBe("Grid fetched 13:00 BST");
  });

  it("formats a later calendar day with the date", () => {
    expect(
      formatLookAheadWindow(
        new Date("2026-10-12T12:00:00.000Z"),
        new Date("2026-10-12T14:00:00.000Z"),
        NOW
      )
    ).toBe("12 Oct 2026, 13:00–15:00 BST");
  });

  it("labels each endpoint with its own offset when a window crosses the clock change", () => {
    expect(
      formatLookAheadWindow(
        new Date("2026-10-24T23:30:00.000Z"),
        new Date("2026-10-25T01:30:00.000Z"),
        new Date("2026-10-24T12:00:00.000Z")
      )
    ).toBe("tomorrow 00:30 BST–01:30 GMT");
    expect(
      formatLookAheadWindow(
        new Date("2026-03-29T00:30:00.000Z"),
        new Date("2026-03-29T01:30:00.000Z"),
        new Date("2026-03-29T00:00:00.000Z")
      )
    ).toBe("00:30 GMT–02:30 BST");
    expect(
      formatLookAheadWindow(
        new Date("2026-10-10T22:00:00.000Z"),
        new Date("2026-10-11T00:00:00.000Z"),
        NOW
      )
    ).toBe("23:00–01:00 BST tomorrow");
  });

  it("strips raw forecast series from the public payload", () => {
    const view = {
      ...emptyLookAhead(NOW),
      greenest: {
        startUtc: "2026-10-10T13:00Z",
        endUtc: "2026-10-10T15:00Z",
        grams: 43,
        sentence: "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g).",
      },
      carbonSeries: [{ time: "2026-10-10 13:00:00", value: 40 }],
      demandSeries: [{ time: "2026-10-10 13:00:00", value: 20_000 }],
      wind: {
        tonightGw: 11,
        tomorrowEveningGw: 8.4,
        sparkline: [11, 8.4],
        sentence: "Wind is forecast to fall to 8.4 GW by tomorrow evening.",
        basis: "Transmission-connected wind only. Embedded wind is not in this forecast." as const,
      },
    };
    const published = publicLookAhead(view);
    expect(published).not.toHaveProperty("carbonSeries");
    expect(published).not.toHaveProperty("demandSeries");
    expect(JSON.stringify(published)).not.toContain("13:00:00");
    expect(published.greenestWindow?.grams).toBe(43);
    expect(published.wind).toEqual({
      tonightGw: 11,
      tomorrowEveningGw: 8.4,
      sentence: "Wind is forecast to fall to 8.4 GW by tomorrow evening.",
      basis: "Transmission-connected wind only. Embedded wind is not in this forecast.",
    });
    expect(published.attribution.carbonNote).toContain("not republished");
  });

  it("hides forecast lines on historic and long ranges", () => {
    expect(showsDemandForecast("24h", false)).toBe(true);
    expect(showsCarbonForecast("7d", false)).toBe(true);
    expect(showsDemandForecast("24h", true)).toBe(false);
    expect(showsCarbonForecast("1y", false)).toBe(false);
    expect(showsDemandForecast("all", false)).toBe(false);
    expect(showsLookAheadCopy({ isHistorical: false, empty: false })).toBe(true);
    expect(showsLookAheadCopy({ isHistorical: true, empty: false })).toBe(false);
    expect(showsLookAheadCopy({ isHistorical: false, empty: true })).toBe(false);
  });
});

describe("loadLookAhead failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("omits look-ahead pieces when upstreams fail and never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      }))
    );

    const view = await loadLookAhead(NOW);
    expect(view.greenest).toBeNull();
    expect(view.wind).toBeNull();
    expect(view.carbonSeries).toEqual([]);
    expect(view.demandSeries).toEqual([]);
    expect(view.fetchedAt).toBe(NOW.toISOString());
  });

  it("keeps wind when only the carbon forecast fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("carbonintensity.org.uk")) {
          return { ok: false, status: 502, json: async () => ({}) };
        }
        if (url.includes("/forecast/generation/wind")) {
          return jsonResponse({
            data: [{ startTime: "2026-10-10T18:00:00Z", generation: 7_000 }],
          });
        }
        return jsonResponse({ data: [] });
      })
    );

    const view = await loadLookAhead(NOW);
    expect(view.greenest).toBeNull();
    expect(view.wind?.sentence).toBe("Wind is forecast at 7.0 GW tonight.");
    expect(view.demandSeries).toEqual([]);
  });
});
