import { describe, expect, it } from "vitest";
import {
  parseCommodityRange,
  parseDashboardPeriod,
  parseInterconnectorRange,
  parseOptionalDate,
  parseTimeRange,
} from "@/lib/api-params";

describe("API query params", () => {
  it("accepts known ranges and rejects unknown ones", () => {
    expect(parseTimeRange("7d")).toEqual({ ok: true, value: "7d" });
    expect(parseTimeRange(null)).toEqual({ ok: true, value: "24h" });
    expect(parseTimeRange("2h").ok).toBe(false);
    expect(parseTimeRange("all").ok).toBe(false);
    expect(parseCommodityRange("1y")).toEqual({ ok: true, value: "1y" });
    expect(parseCommodityRange("24h").ok).toBe(false);
    expect(parseInterconnectorRange("7d")).toEqual({ ok: true, value: "7d" });
    expect(parseInterconnectorRange("30d").ok).toBe(false);
    expect(parseDashboardPeriod("week")).toEqual({ ok: true, value: "week" });
    expect(parseDashboardPeriod(null)).toEqual({ ok: true, value: "day" });
    expect(parseDashboardPeriod("24h").ok).toBe(false);
  });

  it("validates optional dates", () => {
    expect(parseOptionalDate(null)).toEqual({ ok: true, value: null });
    expect(parseOptionalDate("2026-09-27")).toEqual({ ok: true, value: "2026-09-27" });
    expect(parseOptionalDate("27-09-2026").ok).toBe(false);
  });
});
