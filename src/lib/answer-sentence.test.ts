import { describe, expect, it } from "vitest";
import { buildAnswerSentence } from "@/lib/answer-sentence";

describe("buildAnswerSentence", () => {
  it("opens with the leading fuel and the transfer direction", () => {
    expect(
      buildAnswerSentence({
        topFuel: "wind",
        topMw: 12400,
        transfersMw: 2100,
        empty: false,
      })
    ).toBe("Wind is the largest source of Britain’s electricity, and the country is importing 2.1 GW.");

    expect(
      buildAnswerSentence({
        topFuel: "wind",
        topMw: 18000,
        topSharePct: 56,
        transfersMw: 0,
        empty: false,
      })
    ).toBe("Wind is supplying most of Britain’s electricity, with cross-border flows broadly balanced.");
  });

  it("names an export without jargon", () => {
    expect(
      buildAnswerSentence({
        topFuel: "gas",
        topMw: 15000,
        transfersMw: -1800,
        empty: false,
      })
    ).toBe("Gas is the largest source of Britain’s electricity, and the country is exporting 1.8 GW.");
  });

  it("keeps a balanced transfer as a clause, not a stance", () => {
    expect(
      buildAnswerSentence({
        topFuel: "nuclear",
        topMw: 5000,
        transfersMw: 10,
        empty: false,
      })
    ).toBe("Nuclear is the largest source of Britain’s electricity, with cross-border flows broadly balanced.");
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
