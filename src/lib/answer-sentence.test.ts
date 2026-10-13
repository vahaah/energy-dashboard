import { describe, expect, it } from "vitest";
import { buildAnswerSentence } from "@/lib/answer-sentence";

describe("buildAnswerSentence", () => {
  it("opens with the leading fuel and the transfer direction", () => {
    expect(
      buildAnswerSentence({
        topFuel: "wind",
        topMw: 12400,
        topSharePct: 40,
        transfersMw: 2100,
        empty: false,
      })
    ).toBe("Wind is the largest source of Britain’s electricity at 12.4 GW (40%).");

    expect(
      buildAnswerSentence({
        topFuel: "wind",
        topMw: 18000,
        topSharePct: 56,
        transfersMw: 0,
        empty: false,
      })
    ).toBe("Wind is supplying most of Britain’s electricity at 18.0 GW (56%).");
  });

  it("names the fuel in gigawatts and percent, without a net export", () => {
    expect(
      buildAnswerSentence({
        topFuel: "gas",
        topMw: 15000,
        topSharePct: 44,
        transfersMw: -1800,
        empty: false,
      })
    ).toBe("Gas is the largest source of Britain’s electricity at 15.0 GW (44%).");
    expect(
      buildAnswerSentence({
        topFuel: "gas",
        topMw: 15000,
        topSharePct: 44,
        transfersMw: -1800,
        empty: false,
      })
    ).not.toContain("exporting");
  });

  it("keeps a live sentence on the fuel when transfers are balanced", () => {
    expect(
      buildAnswerSentence({
        topFuel: "nuclear",
        topMw: 5000,
        topSharePct: 22,
        transfersMw: 10,
        empty: false,
      })
    ).toBe("Nuclear is the largest source of Britain’s electricity at 5.0 GW (22%).");
  });

  it("frames Year and All time as averages", () => {
    expect(
      buildAnswerSentence({
        topFuel: "wind",
        topMw: 9000,
        transfersMw: 2100,
        empty: false,
        horizon: "year",
      })
    ).toBe(
      "Over the past year, wind has been the largest source of Britain’s electricity, and imports have averaged 2.1 GW."
    );
  });

  it("has a catching-up line when the day is empty", () => {
    expect(
      buildAnswerSentence({
        topFuel: null,
        topMw: null,
        transfersMw: null,
        empty: true,
      })
    ).toBe("Britain’s electricity picture is still catching up.");
  });
});
