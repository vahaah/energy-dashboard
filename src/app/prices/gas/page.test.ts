import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("gas price page", () => {
  it("reuses cached prices_range and does not mention TTF", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("gasPageMetadata");
    expect(source).toContain("loadCachedPublicPrices");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).not.toContain("queryPipe");
    expect(source).not.toMatch(/\bTTF\b/);
  });
});
