import { describe, expect, it } from "vitest";
import {
  getSettlementPeriod,
  listSettlementPeriods,
  periodsInSettlementDay,
  settlementPeriodToUtc,
} from "@/lib/settlement-period";

describe("settlement periods follow UK local time", () => {
  it("maps 10:00 BST on 27 Sep 2026 to period 21, not the UTC period", () => {
    const at = new Date("2026-09-27T09:00:00.000Z");
    const period = getSettlementPeriod(at);

    expect(period.settlementDate).toBe("2026-09-27");
    expect(period.settlementPeriod).toBe(21);
    expect(period.startUtc.toISOString()).toBe("2026-09-27T09:00:00.000Z");
  });

  it("maps the 09:00-09:30 BST period as settlement period 19", () => {
    const start = settlementPeriodToUtc("2026-09-27", 19);
    expect(start.toISOString()).toBe("2026-09-27T08:00:00.000Z");

    const period = getSettlementPeriod(new Date("2026-09-27T08:00:00.000Z"));
    expect(period.settlementPeriod).toBe(19);
    expect(period.settlementDate).toBe("2026-09-27");
  });

  it("does not treat the 08:30-09:00 BST period as the 10:00 BST price", () => {
    const stale = settlementPeriodToUtc("2026-09-27", 18);
    expect(stale.toISOString()).toBe("2026-09-27T07:30:00.000Z");
    expect(getSettlementPeriod(new Date("2026-09-27T09:00:00.000Z")).settlementPeriod).not.toBe(18);
  });

  it("uses 48 periods on a normal GMT day", () => {
    expect(periodsInSettlementDay("2026-01-15")).toBe(48);
    expect(listSettlementPeriods("2026-01-15")).toHaveLength(48);
    expect(getSettlementPeriod(new Date("2026-01-15T10:00:00.000Z")).settlementPeriod).toBe(21);
  });

  it("uses 48 periods on a normal BST day", () => {
    expect(periodsInSettlementDay("2026-06-15")).toBe(48);
    expect(settlementPeriodToUtc("2026-06-15", 1).toISOString()).toBe("2026-06-14T23:00:00.000Z");
    expect(settlementPeriodToUtc("2026-06-15", 48).toISOString()).toBe("2026-06-15T22:30:00.000Z");
  });

  it("uses 46 periods on the 2026 spring-forward day", () => {
    expect(periodsInSettlementDay("2026-03-29")).toBe(46);
    const periods = listSettlementPeriods("2026-03-29");
    expect(periods).toHaveLength(46);
    expect(periods[0]?.startUtc.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(periods[2]?.startUtc.toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(getSettlementPeriod(new Date("2026-03-29T01:30:00.000Z")).settlementPeriod).toBe(4);
  });

  it("uses 50 periods on the 2026 fall-back day", () => {
    expect(periodsInSettlementDay("2026-10-25")).toBe(50);
    const periods = listSettlementPeriods("2026-10-25");
    expect(periods).toHaveLength(50);
    expect(periods[0]?.startUtc.toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(getSettlementPeriod(new Date("2026-10-25T00:30:00.000Z")).settlementPeriod).toBe(4);
    expect(getSettlementPeriod(new Date("2026-10-25T01:30:00.000Z")).settlementPeriod).toBe(6);
    expect(periods[49]?.startUtc.toISOString()).toBe("2026-10-25T23:30:00.000Z");
  });
});
