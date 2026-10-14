import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getLondonDate } from "@/lib/london-time";
import { sliceLondonDay, unwarmedDateError } from "@/lib/warm-window";

describe("warm window", () => {
  const now = new Date("2026-10-14T12:00:00.000Z");

  it("keeps today and an undated request on the rolling envelope", () => {
    expect(getLondonDate(now)).toBe("2026-10-14");
    expect(unwarmedDateError(null, "24h", now)).toBeNull();
    expect(unwarmedDateError("2026-10-14", "24h", now)).toBeNull();
    expect(unwarmedDateError("2026-10-14", "7d", now)).toBeNull();
  });

  it("rejects a London day outside the requested window", () => {
    expect(unwarmedDateError("2026-10-13", "24h", now)).toBe("range_not_warmed");
    expect(unwarmedDateError("2026-12-01", "1y", now)).toBe("range_not_warmed");
    expect(unwarmedDateError("not-a-date", "7d", now)).toBe("range_not_warmed");
  });

  it("accepts yesterday inside the 7d envelope", () => {
    expect(unwarmedDateError("2026-10-13", "7d", now)).toBeNull();
    expect(unwarmedDateError("2026-10-13", "30d", now)).toBeNull();
  });

  it("slices one London civil day and leaves today whole", () => {
    const rows = [
      { timestamp: "2026-10-12 22:30:00" },
      { timestamp: "2026-10-13 00:30:00" },
      { timestamp: "2026-10-13 23:30:00" },
      { timestamp: "2026-10-14 11:00:00" },
    ];

    expect(sliceLondonDay(rows, "2026-10-13", now).map((row) => row.timestamp)).toEqual([
      "2026-10-13 00:30:00",
    ]);
    expect(sliceLondonDay(rows, "2026-10-14", now)).toEqual(rows);
    expect(sliceLondonDay(rows, null, now)).toEqual(rows);
  });

  it("keeps dated public routes on the rolling cache key", () => {
    for (const file of [
      "src/app/api/snapshots/route.ts",
      "src/app/api/generation/route.ts",
      "src/app/api/interconnectors/route.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).toContain("unwarmedDateError");
      expect(source, file).toContain("sliceLondonDay");
      expect(source, file).not.toContain("date: dateResult.value, now");
      expect(source, file).not.toContain("fetchPipeRows");
    }
  });
});
