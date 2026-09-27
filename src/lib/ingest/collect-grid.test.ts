import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/lib/http";
import { collectRecentSnapshots } from "@/lib/ingest/collect-grid";

vi.mock("@/lib/http", () => ({
  fetchJson: vi.fn(),
}));

const mockedFetchJson = vi.mocked(fetchJson);

describe("collectRecentSnapshots source isolation", () => {
  beforeEach(() => {
    mockedFetchJson.mockReset();
  });

  it("still builds snapshot rows when Carbon Intensity fails and Elexon demand is missing", async () => {
    mockedFetchJson.mockImplementation(async (url: string) => {
      if (url.includes("carbonintensity.org.uk")) {
        throw new Error("HTTP 503 for carbon intensity");
      }
      if (url.includes("system-prices")) {
        return {
          data: [
            {
              settlementDate: "2026-09-27",
              settlementPeriod: 21,
              startTime: "2026-09-27T09:30:00Z",
              systemSellPrice: 40,
              systemBuyPrice: 42.5,
            },
          ],
        };
      }
      if (url.includes("datasets/ITSDO")) {
        throw new Error("HTTP 500 for ITSDO");
      }
      if (url.includes("datasets/AGPT")) {
        return {
          data: [
            {
              startTime: "2026-09-27T09:30:00Z",
              settlementDate: "2026-09-27",
              settlementPeriod: 21,
              psrType: "Wind Onshore",
              quantity: 4500,
            },
          ],
        };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const rows = await collectRecentSnapshots(new Date("2026-09-27T10:08:00.000Z"));
    const latest = rows.find((row) => row.timestamp === "2026-09-27 09:30:00");

    expect(rows.length).toBeGreaterThan(0);
    expect(latest).toBeDefined();
    expect(latest?.price_gbp_mwh).toBe(42.5);
    expect(latest?.demand_mw).toBeNull();
    expect(latest?.carbon_intensity).toBeNull();
    expect(latest?.gen_wind_mw).toBe(4500);
  });
});
