import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectGenerationForSettlementDate,
  collectRecentGeneration,
  FUELINST_RECENT_LOOKBACK_MS,
  mergeSettledGeneration,
  pvLiveRowsToIngest,
} from "@/lib/ingest/collect-generation";

describe("generation source isolation", () => {
  it("keeps FUELINST rows when NESO or PV Live fail", () => {
    const result = mergeSettledGeneration([
      {
        source: "fuelinst",
        rows: [
          {
            timestamp: "2026-09-27 10:00:00",
            fuel_type: "gas",
            generation_mw: 8000,
            source: "fuelinst",
          },
        ],
      },
      { source: "neso", error: "HTTP 503 for neso" },
      { source: "pvlive", error: "HTTP 500 for pvlive" },
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.fuel_type).toBe("gas");
    expect(result.sources).toEqual([
      { source: "fuelinst", ok: true, rows: 1 },
      { source: "neso", ok: false, error: "HTTP 503 for neso" },
      { source: "pvlive", ok: false, error: "HTTP 500 for pvlive" },
    ]);
    expect(result.rows.some((row) => row.source === "neso" || row.fuel_type === "embedded_wind")).toBe(
      false
    );
  });

  it("drops PV Live readings after now", () => {
    const rows = pvLiveRowsToIngest(
      [
        [0, "2026-09-27T10:00:00Z", 120],
        [0, "2026-09-27T22:30:00Z", 0],
      ],
      new Date("2026-09-27T10:08:00.000Z")
    );

    expect(rows).toEqual([
      {
        timestamp: "2026-09-27 10:00:00",
        fuel_type: "embedded_solar",
        generation_mw: 120,
        source: "pvlive",
      },
    ]);
  });
});

describe("FUELINST recent look-back", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests at least 24 hours of FUELINST so a missed hourly run can heal", async () => {
    expect(FUELINST_RECENT_LOOKBACK_MS).toBe(24 * 60 * 60 * 1000);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("FUELINST")) {
        return { ok: true, json: async () => [] };
      }
      if (url.includes("neso.energy")) {
        return { ok: true, json: async () => ({ result: { records: [] } }) };
      }
      if (url.includes("pvlive.uk")) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const now = new Date("2026-09-28T10:00:00.000Z");
    await collectRecentGeneration(now);

    const fuelinstUrl = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes("FUELINST"));

    expect(fuelinstUrl).toContain("publishDateTimeFrom=2026-09-27T10:00:00.000Z");
    expect(fuelinstUrl).toContain("publishDateTimeTo=2026-09-28T10:00:00.000Z");
  });

  it("uses a 6h publish lag for settlement-date FUELINST so late publishes are included", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("FUELINST")) {
        return { ok: true, json: async () => [] };
      }
      if (url.includes("neso.energy")) {
        return { ok: true, json: async () => ({ result: { records: [] } }) };
      }
      if (url.includes("pvlive.uk")) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    await collectGenerationForSettlementDate(
      "2026-09-27",
      new Date("2026-09-28T03:30:00.000Z")
    );

    const fuelinstUrl = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes("FUELINST"));
    const pvLiveUrl = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .find((url) => url.includes("pvlive.uk"));

    expect(fuelinstUrl).toContain("publishDateTimeFrom=2026-09-26T23:00:00.000Z");
    expect(fuelinstUrl).toContain("publishDateTimeTo=2026-09-28T03:30:00.000Z");
    expect(pvLiveUrl).toContain("start=2026-09-26T23:00:00.000Z");
    expect(pvLiveUrl).toContain("end=2026-09-27T23:00:00.000Z");
  });
});
