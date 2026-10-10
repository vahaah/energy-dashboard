import { beforeEach, describe, expect, it, vi } from "vitest";

const queryPipe = vi.fn();
const getHistoricPeriodView = vi.fn();
const getGridRecords = vi.fn();
const getLookAhead = vi.fn();

vi.mock("@/lib/tinybird", () => ({
  queryPipe: (...args: unknown[]) => queryPipe(...args),
}));

vi.mock("@/lib/neso-historic", () => ({
  getHistoricPeriodView: (...args: unknown[]) => getHistoricPeriodView(...args),
  getGridRecords: (...args: unknown[]) => getGridRecords(...args),
}));

vi.mock("@/lib/forecasts", () => ({
  getLookAhead: (...args: unknown[]) => getLookAhead(...args),
}));

import {
  compactHistoricPayload,
  dashboardPayloadCacheDate,
  dashboardPayloadPolicy,
  hydrateDashboardPayload,
  loadDashboardPayloadUncached,
} from "@/lib/dashboard-payload";
import { buildHistoricPeriodView, emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";

describe("dashboard payload", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");

  beforeEach(() => {
    queryPipe.mockReset();
    getHistoricPeriodView.mockReset();
    getGridRecords.mockReset();
    getLookAhead.mockReset();
    queryPipe.mockResolvedValue([]);
    getHistoricPeriodView.mockResolvedValue(buildHistoricPeriodView([]));
    getGridRecords.mockResolvedValue(emptyRecordsWithDocumentedCoal(now));
    getLookAhead.mockResolvedValue(null);
  });

  it("uses Tinybird for Day and skips grid pipes for Year", async () => {
    await loadDashboardPayloadUncached({
      period: "day",
      commodityRange: "90d",
      now,
    });
    expect(queryPipe).toHaveBeenCalled();
    expect(queryPipe.mock.calls.some((call) => call[0] === "snapshots_range")).toBe(true);

    queryPipe.mockClear();
    await loadDashboardPayloadUncached({
      period: "year",
      commodityRange: "90d",
      now,
    });
    expect(queryPipe.mock.calls.every((call) => call[0] === "prices_range")).toBe(true);
    expect(getHistoricPeriodView).toHaveBeenCalledWith("year", now);
  });

  it("uses historical cache for NESO periods and live cache for Day", () => {
    expect(dashboardPayloadPolicy("day").tier).toBe("live");
    expect(dashboardPayloadPolicy("year").tier).toBe("historical");
    expect(dashboardPayloadPolicy("all").tier).toBe("historical");
  });

  it("keeps out-of-coverage dates off the live Day key", () => {
    expect(
      dashboardPayloadCacheDate(
        {
          status: "empty",
          date: "2010-01-01",
          today: "2026-10-10",
          coverageStart: "2025-10-10",
        },
        "2010-01-01"
      )
    ).toBe("2010-01-01");
    expect(
      dashboardPayloadCacheDate(
        {
          status: "latest",
          date: "2026-10-10",
          today: "2026-10-10",
          coverageStart: "2025-10-10",
        },
        null
      )
    ).toBeNull();
  });

  it("rethrows a mandatory snapshots_range failure instead of returning empty data", async () => {
    queryPipe.mockImplementation((pipe: string) => {
      if (pipe === "snapshots_range") {
        return Promise.reject(new Error("tinybird down"));
      }
      return Promise.resolve([]);
    });

    await expect(
      loadDashboardPayloadUncached({
        period: "day",
        commodityRange: "90d",
        now,
      })
    ).rejects.toThrow("tinybird down");
  });

  it("rethrows a required Year historic-view failure", async () => {
    getHistoricPeriodView.mockImplementation((period: string) => {
      if (period === "year") {
        return Promise.reject(new Error("neso down"));
      }
      return Promise.resolve(buildHistoricPeriodView([]));
    });

    await expect(
      loadDashboardPayloadUncached({
        period: "year",
        commodityRange: "90d",
        now,
      })
    ).rejects.toThrow("neso down");
  });

  it("still loads Day when the optional all-time transition view fails", async () => {
    getHistoricPeriodView.mockRejectedValue(new Error("neso down"));

    await expect(
      loadDashboardPayloadUncached({
        period: "day",
        commodityRange: "90d",
        now,
      })
    ).resolves.toMatchObject({ period: "day", historicView: null });
  });

  it("serializes the all-time historic series once", async () => {
    const historic = buildHistoricPeriodView([]);
    historic.snapshots = [{ timestamp: "2026-01-01 00:00:00" } as never];
    historic.generation = [{ timestamp: "2026-01-01 00:00:00", fuel_type: "wind" } as never];
    getHistoricPeriodView.mockResolvedValue(historic);

    const payload = await loadDashboardPayloadUncached({
      period: "all",
      commodityRange: "90d",
      now,
    });
    expect(payload.historicView).toBeTruthy();
    expect(payload.transitionView).toBeNull();
    expect(payload.snapshots).toEqual([]);
    expect(payload.generationHistory).toEqual([]);
    const hydrated = hydrateDashboardPayload(payload);
    expect(hydrated.snapshots).toEqual(historic.snapshots);
    expect(hydrated.transitionView).toEqual(historic);
    expect(compactHistoricPayload(hydrated).transitionView).toBeNull();
    expect(payload.prices).toEqual([]);
  });

  it("publishes only the public look-ahead shape", async () => {
    getLookAhead.mockResolvedValue({
      fetchedAt: "2026-10-10T12:00:00.000Z",
      greenest: {
        startUtc: "2026-10-10T13:00Z",
        endUtc: "2026-10-10T15:00Z",
        grams: 43,
        sentence: "Cleanest window",
      },
      carbonSeries: [{ time: "2026-10-10 13:00:00", value: 40 }],
      wind: {
        tonightGw: 11,
        tomorrowEveningGw: 8,
        sparkline: [11, 8],
        sentence: "Wind falls",
        basis: "Transmission-connected wind only. Embedded wind is not in this forecast.",
      },
      demandSeries: [{ time: "2026-10-10 13:00:00", value: 19_500 }],
    });

    const payload = await loadDashboardPayloadUncached({
      period: "day",
      commodityRange: "90d",
      now,
    });
    expect(payload.lookAhead?.greenestWindow?.grams).toBe(43);
    expect(payload.lookAhead).not.toHaveProperty("carbonSeries");
    expect(payload.lookAhead).not.toHaveProperty("demandSeries");
    expect(JSON.stringify(payload.lookAhead)).not.toContain("13:00:00");
  });
});
