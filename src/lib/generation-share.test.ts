import { describe, expect, it } from "vitest";
import {
  formatSharePercent,
  generationMixFromSupplyShares,
  generationMixShares,
  shareBarSegmentStyle,
  sharesSumWithinTolerance,
  showsInlineShareLabel,
  STORAGE_CHARGING_MIN_MW,
} from "@/lib/generation-share";
import type { Generation5min } from "@/lib/types";

function row(timestamp: string, fuel: string, mw: number, source = "fuelinst"): Generation5min {
  return { timestamp, fuel_type: fuel, generation_mw: mw, source };
}

const PERIOD = "2026-10-13 08:00:00";

describe("generation mix shares", () => {
  const rows = [
    row(PERIOD, "wind", 18_800),
    row(PERIOD, "ccgt", 6_200),
    row(PERIOD, "nuclear", 4_100),
    row(PERIOD, "biomass", 2_500),
    row(PERIOD, "embedded_solar", 1_100, "pvlive"),
    row(PERIOD, "other", 1_000),
    row(PERIOD, "npshyd", 600),
    row(PERIOD, "ps", 300),
    row(PERIOD, "intnsl", 1_050),
    row(PERIOD, "intned", 450),
    row(PERIOD, "intfr", -1_800),
    row(PERIOD, "intirl", -900),
  ];

  it("sums to 100% of generation, largest first, with no interconnectors", () => {
    const shares = generationMixShares(rows, "2026-10-13T08:00:00.000Z");
    const sum = shares.reduce((total, share) => total + share.sharePct, 0);

    expect(sharesSumWithinTolerance(shares)).toBe(true);
    expect(sum).toBeGreaterThanOrEqual(100 - 0.1);
    expect(sum).toBeLessThanOrEqual(100 + 0.1);
    expect(shares.map((share) => share.fuel)).not.toContain("imports");
    expect(shares.some((share) => share.fuel.startsWith("int"))).toBe(false);
    expect(shares.map((share) => share.mw)).toEqual(
      [...shares].sort((left, right) => right.mw - left.mw).map((share) => share.mw)
    );
    expect(shares[0]?.fuel).toBe("wind");
    expect(formatSharePercent(shares[0]?.sharePct ?? 0)).toBe(
      formatSharePercent((18_800 / (18_800 + 6_200 + 4_100 + 2_500 + 1_100 + 1_000 + 600 + 300)) * 100)
    );
  });

  it("uses the same percentages from fuel totals and from settlement rows", () => {
    const fromRows = generationMixShares(rows, "2026-10-13T08:00:00.000Z");
    const fromParts = generationMixFromSupplyShares(
      fromRows.map((share) => ({ fuel: share.fuel, mw: share.mw }))
    );

    expect(fromParts.map((share) => share.fuel)).toEqual(fromRows.map((share) => share.fuel));
    for (const share of fromRows) {
      const match = fromParts.find((part) => part.fuel === share.fuel);
      expect(match?.sharePct).toBeCloseTo(share.sharePct, 5);
    }
  });

  it("drops importing interconnectors instead of inflating the bar", () => {
    const shares = generationMixFromSupplyShares([
      { fuel: "wind", mw: 10_000 },
      { fuel: "INTFR", mw: 4_000 },
      { fuel: "INTNED", mw: -1_000 },
      { fuel: "gas", mw: 5_000 },
    ]);

    expect(shares.find((share) => share.fuel === "imports")).toBeUndefined();
    expect(shares.reduce((sum, share) => sum + share.sharePct, 0)).toBeCloseTo(100, 5);
    expect(shares.find((share) => share.fuel === "wind")?.sharePct).toBeCloseTo((10_000 / 15_000) * 100, 5);
  });

  it("keeps storage discharge in generation and leaves charging out", () => {
    const shares = generationMixShares(
      [
        row(PERIOD, "wind", 10_000),
        row(PERIOD, "ps", 800),
        row(PERIOD, "ps", -2_000),
        row(PERIOD, "bess", -400),
        row(PERIOD, "intfr", 100),
      ],
      "2026-10-13T08:00:00.000Z"
    );

    expect(shares.find((share) => share.fuel === "pumped_storage")?.mw).toBe(400);
    expect(shares.find((share) => share.fuel === "battery")).toBeUndefined();
    expect(sharesSumWithinTolerance(shares)).toBe(true);
    expect(STORAGE_CHARGING_MIN_MW).toBe(50);
  });

  it("keeps the previous fuels when the requested period is incomplete", () => {
    const older = "2026-10-13 07:30:00";
    const shares = generationMixShares(
      [
        row(older, "wind", 10_000),
        row(older, "ccgt", 5_000),
        row(older, "intfr", 1_000),
        row(PERIOD, "ccgt", 8_000),
      ],
      "2026-10-13T08:00:00.000Z"
    );

    expect(shares.find((share) => share.fuel === "wind")?.mw).toBe(10_000);
    expect(shares.find((share) => share.fuel === "gas")?.mw).toBe(8_000);
    expect(shares.find((share) => share.fuel === "gas")?.sharePct).not.toBeCloseTo(100, 0);
    expect(sharesSumWithinTolerance(shares)).toBe(true);
  });

  it("sizes the bar with flex-grow so the track cannot exceed 100%", () => {
    const shares = generationMixShares(rows, "2026-10-13T08:00:00.000Z");
    const styles = shares.map((share) => shareBarSegmentStyle(share.sharePct));
    const grown = styles.reduce((sum, style) => sum + style.flexGrow, 0);

    expect(grown).toBeCloseTo(100, 5);
    expect(styles.every((style) => style.flexBasis === 0 && style.minWidth === 0)).toBe(true);
    expect(styles.every((style) => !("width" in style))).toBe(true);
    expect(showsInlineShareLabel(54, false)).toBe(true);
    expect(showsInlineShareLabel(12, true)).toBe(false);
    expect(showsInlineShareLabel(15, true)).toBe(true);
  });
});
