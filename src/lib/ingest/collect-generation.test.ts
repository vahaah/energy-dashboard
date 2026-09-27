import { describe, expect, it } from "vitest";
import {
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
