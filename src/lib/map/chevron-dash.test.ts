import { describe, expect, it } from "vitest";
import { CHEVRON_STEPS, chevronDash } from "@/lib/map/chevron-dash";

describe("chevron dash", () => {
  it("keeps a handful of patterns so the line atlas cannot fill up", () => {
    const patterns = Array.from({ length: CHEVRON_STEPS }, (_, step) => chevronDash(step));
    expect(new Set(patterns.map((pattern) => pattern.join(","))).size).toBe(CHEVRON_STEPS);
    for (const pattern of patterns) {
      expect(pattern.every((part) => part >= 0.25)).toBe(true);
      expect(pattern).not.toContain(0);
    }
    expect(chevronDash(0)).toEqual(chevronDash(CHEVRON_STEPS));
  });
});
