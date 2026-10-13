import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bakeTabularFigures, mappedDigitAdvances } from "@/lib/og/tabular-font";

const SANS = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
const MONO = join(process.cwd(), "node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf");

describe("tabular OG fonts", () => {
  it("gives Geist Sans digits one advance width", () => {
    for (const file of ["Geist-Regular.ttf", "Geist-Medium.ttf", "Geist-SemiBold.ttf"]) {
      const original = readFileSync(join(SANS, file));
      const before = mappedDigitAdvances(original);
      const baked = bakeTabularFigures(original);
      const after = mappedDigitAdvances(baked);

      expect(before).not.toBeNull();
      expect(new Set(before).size).toBeGreaterThan(1);
      expect(after).not.toBeNull();
      expect(new Set(after).size).toBe(1);
      expect(baked.equals(original)).toBe(false);
    }
  });

  it("leaves Geist Mono, which is already tabular, unchanged", () => {
    const original = readFileSync(MONO);
    const before = mappedDigitAdvances(original);
    expect(new Set(before).size).toBe(1);
    expect(bakeTabularFigures(original).equals(original)).toBe(true);
  });
});
