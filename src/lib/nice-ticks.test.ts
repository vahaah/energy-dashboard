import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { niceTicks } from "@/lib/nice-ticks";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(left: string, right: string): number {
  const lighter = Math.max(luminance(left), luminance(right));
  const darker = Math.min(luminance(left), luminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("niceTicks", () => {
  it("includes zero and does not pad a small negative out to a coarse step", () => {
    const ticks = niceTicks(-150_000_000, 6_000_000_000, { target: 5 });
    expect(ticks[0]).toBeLessThan(0);
    expect(ticks).toContain(0);
    expect(ticks[0]).toBeGreaterThan(-2_000_000_000);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(6_000_000_000);
  });

  it("starts at zero when every value is positive", () => {
    const ticks = niceTicks(1_000, 60_000, { target: 5 });
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(60_000);
  });
});

describe("balancing chart colours", () => {
  it("keeps neighbouring stack colours at least 3:1 apart in light and dark", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const light = css.match(/:root,\s*\.light\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const dark = css.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const names = [
      "imbalance",
      "frequency",
      "positive",
      "negative",
      "constraints",
      "other",
    ];
    for (const block of [light, dark]) {
      const colors = names.map((name) => {
        const match = new RegExp(`--chart-balancing-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
        expect(match?.[1], name).toBeTruthy();
        return match?.[1] ?? "#000000";
      });
      for (let index = 0; index < colors.length - 1; index += 1) {
        expect(contrast(colors[index] ?? "#000", colors[index + 1] ?? "#fff")).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
