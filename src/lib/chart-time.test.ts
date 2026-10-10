import { describe, expect, it } from "vitest";
import { chartTimeDomain, chartTimeMs, evenTimeTicks, timeTickCount } from "@/lib/chart-time";

describe("chart time axis", () => {
  it("spaces ticks evenly across a gap", () => {
    const start = chartTimeMs("2026-10-10 07:00:00");
    const end = chartTimeMs("2026-10-11 06:00:00");
    const ticks = evenTimeTicks(start, end, 3);

    expect(ticks).toHaveLength(3);
    expect(ticks[1] - ticks[0]).toBe(ticks[2] - ticks[1]);
    expect(ticks[0]).toBe(start);
    expect(ticks[2]).toBe(end);
    expect(chartTimeDomain(["2026-10-10 07:00:00", "2026-10-11 06:00:00"])).toEqual([
      start,
      end,
    ]);
  });

  it("uses three ticks on a compact 48-hour span", () => {
    expect(timeTickCount(48 * 60 * 60 * 1000, true)).toBe(3);
    expect(timeTickCount(48 * 60 * 60 * 1000, false)).toBe(6);
  });
});
