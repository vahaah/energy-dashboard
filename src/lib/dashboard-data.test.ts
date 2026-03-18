import { describe, expect, it } from "vitest";
import {
  getGenerationQueryParams,
  getInterconnectorQueryParams,
  getSnapshotsQueryParams,
} from "@/lib/dashboard-data";

describe("dashboard data query params", () => {
  it("uses the selected calendar day for 24h snapshot queries", () => {
    expect(
      getSnapshotsQueryParams("24h", new Date("2026-03-18T15:30:00.000Z"), "2026-03-10")
    ).toEqual({
      start: "2026-03-10 00:00:00",
      end: "2026-03-10 23:59:59",
    });
  });

  it("uses the selected calendar day for 24h generation queries", () => {
    expect(
      getGenerationQueryParams("24h", new Date("2026-03-18T15:30:00.000Z"), "2026-03-10")
    ).toEqual({
      start: "2026-03-10 00:00:00",
      end: "2026-03-10 23:59:59",
    });
  });

  it("uses the selected calendar day for 24h interconnector queries", () => {
    expect(
      getInterconnectorQueryParams("24h", new Date("2026-03-18T15:30:00.000Z"), "2026-03-10")
    ).toEqual({
      start: "2026-03-10 00:00:00",
      end: "2026-03-10 23:59:59",
    });
  });
});
