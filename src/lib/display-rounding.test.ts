import { describe, expect, it } from "vitest";
import {
  displayedPercents,
  formatDisplay,
  reconcileSignedDisplay,
  type SignedDisplayPart,
} from "@/lib/display-rounding";

const GW = 0.1;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function signedSum(parts: readonly number[], signs: readonly (1 | -1)[]): number {
  return parts.reduce((total, value, index) => total + (signs[index] ?? 1) * value, 0);
}

describe("display rounding", () => {
  it("reconciles the 14 Oct 16:00 UTC headline that independent rounding misses by 0.1", () => {
    const generation = 36.884473;
    const imports = 1.745;
    const exports = 2.754;
    const demand = generation + imports - exports;
    const independent = [
      Number(generation.toFixed(1)),
      Number(imports.toFixed(1)),
      Number(exports.toFixed(1)),
    ];
    expect(independent[0]! + independent[1]! - independent[2]!).toBeCloseTo(35.8, 8);
    expect(Number(demand.toFixed(1))).toBe(35.9);

    const shown = reconcileSignedDisplay(
      [
        { value: generation, sign: 1 },
        { value: imports, sign: 1 },
        { value: exports, sign: -1 },
      ],
      demand,
      GW
    );

    expect(shown.parts.map((value) => formatDisplay(value, GW))).toEqual(["36.9", "1.7", "2.7"]);
    expect(formatDisplay(shown.total, GW)).toBe("35.9");
    expect(shown.parts[0]! + shown.parts[1]! - shown.parts[2]!).toBe(shown.total);
  });

  it("reconciles the demand-chart tooltip 28.8 + 3.8 vs 32.5", () => {
    const generation = 28.769;
    const demand = 32.521;
    const gap = demand - generation;
    expect(Number(generation.toFixed(1)) + Number(gap.toFixed(1))).toBe(32.6);
    expect(Number(demand.toFixed(1))).toBe(32.5);

    const shown = reconcileSignedDisplay(
      [
        { value: generation, sign: 1 },
        { value: gap, sign: 1 },
      ],
      demand,
      GW
    );

    expect(shown.parts.map((value) => formatDisplay(value, GW))).toEqual(["28.8", "3.7"]);
    expect(formatDisplay(shown.total, GW)).toBe("32.5");
    expect(shown.parts[0]! + shown.parts[1]!).toBe(shown.total);
  });

  it("turns the 45/25/12/7/5/4/2/1 share list into a total of 100", () => {
    const megawatts = [16705.5, 9112.5, 4294.7, 2743.2, 1733.8, 1426.6, 588.3, 279.8];
    const total = megawatts.reduce((sum, value) => sum + value, 0);
    const exact = megawatts.map((value) => (value / total) * 100);
    const independent = exact.map((value) => Math.round(value));

    expect(independent).toEqual([45, 25, 12, 7, 5, 4, 2, 1]);
    expect(independent.reduce((sum, value) => sum + value, 0)).toBe(101);
    expect(Number(exact.reduce((sum, value) => sum + value, 0).toFixed(1))).toBe(100);

    const shown = displayedPercents(exact);
    expect(shown).toEqual([45, 25, 12, 7, 5, 4, 1, 1]);
    expect(shown.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("keeps random signed gigawatt terms on the rounded total", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = mulberry32(seed);
      const count = 1 + Math.floor(random() * 6);
      const parts: SignedDisplayPart[] = [];
      for (let index = 0; index < count; index += 1) {
        parts.push({
          value: random() * 40,
          sign: random() < 0.7 ? 1 : -1,
        });
      }
      const total = parts.reduce((sum, part) => sum + part.sign * part.value, 0);
      const shown = reconcileSignedDisplay(parts, total, GW);
      const signs = parts.map((part) => (part.value < 0 ? (part.sign === 1 ? -1 : 1) : part.sign));
      const magnitudes = parts.map((part) => Math.abs(part.value));
      expect(signedSum(shown.parts, signs)).toBeCloseTo(shown.total, 8);
      expect(formatDisplay(signedSum(shown.parts, signs), GW)).toBe(formatDisplay(shown.total, GW));
      shown.parts.forEach((value, index) => {
        const raw = magnitudes[index] ?? 0;
        const quanta = Math.round(snapQuanta(raw / GW));
        const floor = Math.floor(snapQuanta(raw / GW) + 1e-8);
        const shownQuanta = Math.round(value / GW);
        expect(shownQuanta).toBeGreaterThanOrEqual(floor);
        expect(shownQuanta).toBeLessThanOrEqual(Math.max(floor + 1, quanta));
      });
    }
  });

  it("keeps random generation shares on 100", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = mulberry32(seed + 10_000);
      const count = 1 + Math.floor(random() * 12);
      const weights = Array.from({ length: count }, () => random() * 20_000 + 0.01);
      const total = weights.reduce((sum, value) => sum + value, 0);
      const exact = weights.map((value) => (value / total) * 100);
      const shown = displayedPercents(exact);

      expect(shown.reduce((sum, value) => sum + value, 0)).toBe(100);
      expect(shown.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
      shown.forEach((value, index) => {
        expect(Math.abs(value - (exact[index] ?? 0))).toBeLessThanOrEqual(1);
      });
    }
  });
});

function snapQuanta(value: number): number {
  return Number(value.toFixed(6));
}
