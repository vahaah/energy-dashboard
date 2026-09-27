import { describe, expect, it } from "vitest";
import { backfillSettlementDates, listSettlementDatesInclusive } from "@/lib/backfill-range";

describe("backfill UK settlement dates", () => {
  it("treats --from/--to as inclusive UK settlement dates during BST", () => {
    expect(listSettlementDatesInclusive("2026-09-27", "2026-09-27")).toEqual(["2026-09-27"]);
    expect(backfillSettlementDates({ from: "2026-09-26", to: "2026-09-27" })).toEqual([
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("does not roll --to into the next London day the way a UTC 23:59 cutoff would", () => {
    const leakedNextLondonDay = new Date("2026-09-27T23:59:59Z");
    expect(leakedNextLondonDay.toISOString()).toBe("2026-09-27T23:59:59.000Z");

    const dates = backfillSettlementDates({
      from: "2026-09-27",
      to: "2026-09-27",
      now: leakedNextLondonDay,
    });

    expect(dates).toEqual(["2026-09-27"]);
    expect(dates).not.toContain("2026-09-28");
  });

  it("uses last N inclusive UK dates for --days", () => {
    expect(
      backfillSettlementDates({
        days: 2,
        now: new Date("2026-09-27T10:08:00.000Z"),
      })
    ).toEqual(["2026-09-26", "2026-09-27"]);
  });
});
