import { describe, expect, it } from "vitest";
import {
  formatLondonCiteDate,
  formatLondonIsoOffset,
  parseUtcDateTime,
  utcIsoFromTimestamp,
} from "@/lib/london-time";

describe("London cite stamps", () => {
  it("formats GMT and BST instants with an offset", () => {
    const gmt = new Date("2026-03-25T13:30:00.000Z");
    expect(formatLondonIsoOffset(gmt)).toBe("2026-03-25T13:30:00+00:00");
    expect(formatLondonCiteDate(gmt)).toBe("Wed 25 Mar 2026");

    const bst = new Date("2026-10-10T11:00:00.000Z");
    expect(formatLondonIsoOffset(bst)).toBe("2026-10-10T12:00:00+01:00");
    expect(formatLondonCiteDate(bst)).toBe("Sat 10 Oct 2026");
  });

  it("round-trips Tinybird UTC and London offset ISO without Invalid Date", () => {
    expect(parseUtcDateTime("2026-10-10 11:00:00").toISOString()).toBe("2026-10-10T11:00:00.000Z");
    expect(parseUtcDateTime("2026-10-10T11:00:00.000Z").toISOString()).toBe(
      "2026-10-10T11:00:00.000Z"
    );
    expect(parseUtcDateTime("2026-10-10T12:00:00+01:00").toISOString()).toBe(
      "2026-10-10T11:00:00.000Z"
    );
    expect(parseUtcDateTime("2026-03-25T13:30:00+00:00").toISOString()).toBe(
      "2026-03-25T13:30:00.000Z"
    );
    expect(utcIsoFromTimestamp("2026-10-10T12:00:00+01:00")).toBe("2026-10-10T11:00:00.000Z");
    expect(utcIsoFromTimestamp("not-a-date")).toBeUndefined();
    expect(utcIsoFromTimestamp(null)).toBeUndefined();
  });
});
