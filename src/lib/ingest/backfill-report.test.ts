import { describe, expect, it } from "vitest";
import { describeCollection, shouldFailBackfill } from "@/lib/ingest/backfill-report";

describe("backfill source reporting", () => {
  it("reports per-source failures instead of no data and fails the run", () => {
    const failed = {
      rows: [
        {
          timestamp: "2026-09-27 10:00:00",
          fuel_type: "gas",
          generation_mw: 8000,
          source: "fuelinst",
        },
      ],
      sources: [
        { source: "fuelinst", ok: true, rows: 1 },
        { source: "neso", ok: false, error: "HTTP 503 for neso" },
      ],
    };
    const emptyFailure = {
      rows: [],
      sources: [
        { source: "fuelinst", ok: false, error: "HTTP 500" },
        { source: "neso", ok: false, error: "HTTP 503" },
      ],
    };

    expect(describeCollection(failed)).toContain("fuelinst=1");
    expect(describeCollection(failed)).toContain("neso failed: HTTP 503 for neso");
    expect(describeCollection(emptyFailure)).toContain("skipped ingest");
    expect(describeCollection(emptyFailure)).not.toBe("no data");
    expect(shouldFailBackfill([failed, emptyFailure])).toBe(true);
    expect(shouldFailBackfill([{ sources: [{ source: "fuelinst", ok: true, rows: 1 }] }])).toBe(
      false
    );
  });
});
