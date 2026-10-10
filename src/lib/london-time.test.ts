import { describe, expect, it } from "vitest";
import { formatLondonCiteDate, formatLondonIsoOffset } from "@/lib/london-time";

describe("London cite stamps", () => {
  it("formats GMT and BST instants with an offset", () => {
    const gmt = new Date("2026-03-25T13:30:00.000Z");
    expect(formatLondonIsoOffset(gmt)).toBe("2026-03-25T13:30:00+00:00");
    expect(formatLondonCiteDate(gmt)).toBe("Wed 25 Mar 2026");

    const bst = new Date("2026-10-10T11:00:00.000Z");
    expect(formatLondonIsoOffset(bst)).toBe("2026-10-10T12:00:00+01:00");
    expect(formatLondonCiteDate(bst)).toBe("Sat 10 Oct 2026");
  });
});
