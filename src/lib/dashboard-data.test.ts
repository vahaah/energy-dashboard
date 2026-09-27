import { describe, expect, it } from "vitest";
import {
  getEffectiveDashboardDate,
  getGenerationQueryParams,
  getInterconnectorQueryParams,
  getSnapshotsQueryParams,
} from "@/lib/dashboard-data";

describe("dashboard data query params", () => {
  it("uses a rolling 24 hours when no historical date is selected", () => {
    const now = new Date("2026-03-18T15:30:00.000Z");

    expect(getSnapshotsQueryParams("24h", now)).toEqual({
      start: "2026-03-17 15:30:00",
      end: "2026-03-18 15:30:00",
    });
    expect(getGenerationQueryParams("24h", now)).toEqual({
      start: "2026-03-17 15:30:00",
      end: "2026-03-18 15:30:00",
    });
    expect(getInterconnectorQueryParams("24h", now)).toEqual({
      start: "2026-03-17 15:30:00",
      end: "2026-03-18 15:30:00",
    });
  });

  it("still uses a selected historical UK calendar day for 24h", () => {
    const now = new Date("2026-03-18T15:30:00.000Z");

    expect(getSnapshotsQueryParams("24h", now, "2026-03-10")).toEqual({
      start: "2026-03-10 00:00:00",
      end: "2026-03-10 23:59:59",
    });
    expect(getGenerationQueryParams("24h", now, "2026-03-10")).toEqual({
      start: "2026-03-10 00:00:00",
      end: "2026-03-10 23:59:59",
    });
    expect(getInterconnectorQueryParams("24h", now, "2026-03-10")).toEqual({
      start: "2026-03-10 00:00:00",
      end: "2026-03-10 23:59:59",
    });
  });

  it("treats today's date picker value as rolling 24h, not a UTC calendar day", () => {
    const now = new Date("2026-03-18T15:30:00.000Z");
    expect(getSnapshotsQueryParams("24h", now, "2026-03-18")).toEqual({
      start: "2026-03-17 15:30:00",
      end: "2026-03-18 15:30:00",
    });
  });

  it("interprets a selected historical day in Europe/London, including BST", () => {
    expect(
      getSnapshotsQueryParams("24h", new Date("2026-06-18T15:30:00.000Z"), "2026-06-10")
    ).toEqual({
      start: "2026-06-09 23:00:00",
      end: "2026-06-10 22:59:59",
    });
  });

  it("uses the UK date for the date picker default", () => {
    expect(getEffectiveDashboardDate(null, new Date("2026-03-18T23:30:00.000Z"))).toBe(
      "2026-03-18"
    );
    expect(getEffectiveDashboardDate(null, new Date("2026-06-18T23:30:00.000Z"))).toBe(
      "2026-06-19"
    );
  });
});
