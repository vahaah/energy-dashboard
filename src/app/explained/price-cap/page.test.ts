import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("price cap page", () => {
  it("launches without January 2027 figures or an update promise", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("export const revalidate = 86_400");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("priceCapPageMetadata");
    expect(source).toContain("PUBLISHED_PRICE_CAPS");
    expect(source).toContain("OFGEM_JAN_2027_ANNOUNCEMENT_LABEL");
    expect(source).toContain("January 2027 energy price cap");
    expect(source).toContain('href="/methodology"');
    expect(source).toContain("loadCachedPublicPrices");
    expect(source).toContain('loadCachedPublicPrices("1y")');
    expect(source).not.toContain('loadCachedPublicPrices("90d")');
    expect(source).not.toContain("we will update");
    expect(source).not.toContain("within the hour");
    expect(source).not.toContain("January–March 2027 cap is");
    expect(source).not.toMatch(/£1,\d{3}[^\n]{0,40}January 2027/);
  });
});
