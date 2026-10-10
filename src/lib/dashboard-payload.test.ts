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

import { dashboardPayloadPolicy, loadDashboardPayloadUncached } from "@/lib/dashboard-payload";
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
});
