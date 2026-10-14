import { describe, expect, it } from "vitest";
import { clampTooltipLeft, placeTooltipTop } from "@/lib/tooltip-position";

describe("clampTooltipLeft", () => {
  it("keeps a 280px tooltip inside a 390px viewport", () => {
    const placement = clampTooltipLeft(340, 44, 390);

    expect(placement.width).toBe(280);
    expect(placement.left).toBeGreaterThanOrEqual(16);
    expect(placement.left + placement.width).toBeLessThanOrEqual(374);
  });

  it("flips below the anchor when the tooltip would leave the viewport", () => {
    expect(placeTooltipTop(200, 44, 80, 800)).toBe(112);
    expect(placeTooltipTop(20, 44, 80, 800)).toBe(72);
  });
});
