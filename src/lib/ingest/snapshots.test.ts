import { describe, expect, it } from "vitest";
import { buildSnapshotRow } from "@/lib/ingest/snapshots";
import { nesoRecordsToIngest } from "@/lib/ingest/collect-generation";

describe("snapshot nulls", () => {
  it("stores missing source fields as null instead of 0", () => {
    const row = buildSnapshotRow({
      timestamp: new Date("2026-09-27T08:00:00.000Z"),
    });

    expect(row.timestamp).toBe("2026-09-27 08:00:00");
    expect(row.price_gbp_mwh).toBeNull();
    expect(row.demand_mw).toBeNull();
    expect(row.carbon_intensity).toBeNull();
    expect(row.gen_gas_pct).toBeNull();
    expect(row.gen_wind_mw).toBeNull();
  });

  it("keeps a real zero generation share when the mix arrived", () => {
    const row = buildSnapshotRow({
      timestamp: new Date("2026-09-27T08:00:00.000Z"),
      mix: { gas: 40, wind: 60 },
      priceGbpMwh: -13.47,
    });

    expect(row.price_gbp_mwh).toBe(-13.47);
    expect(row.gen_coal_pct).toBe(0);
    expect(row.gen_gas_pct).toBe(40);
  });
});

describe("NESO settlement mapping", () => {
  it("uses UK-local settlement periods and prefers actuals", () => {
    const rows = nesoRecordsToIngest(
      [
        {
          SETTLEMENT_DATE: "2026-09-27",
          SETTLEMENT_PERIOD: "21",
          FORECAST_ACTUAL_INDICATOR: "F",
          EMBEDDED_WIND_GENERATION: "100",
        },
        {
          SETTLEMENT_DATE: "2026-09-27",
          SETTLEMENT_PERIOD: "21",
          FORECAST_ACTUAL_INDICATOR: "A",
          EMBEDDED_WIND_GENERATION: "90",
        },
      ],
      "embedded_wind"
    );

    expect(rows).toEqual([
      {
        timestamp: "2026-09-27 09:00:00",
        fuel_type: "embedded_wind",
        generation_mw: 90,
        source: "neso",
      },
    ]);
  });

  it("stores a real zero instead of dropping the reading", () => {
    const rows = nesoRecordsToIngest(
      [
        {
          SETTLEMENT_DATE: "2026-09-27",
          SETTLEMENT_PERIOD: "2",
          FORECAST_ACTUAL_INDICATOR: "A",
          EMBEDDED_WIND_GENERATION: "0",
        },
      ],
      "embedded_wind"
    );

    expect(rows[0]?.generation_mw).toBe(0);
  });
});
