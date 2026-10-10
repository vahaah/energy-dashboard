import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cached public prices", () => {
  it("hits the warmed prices_range key and no new pipe", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./cached-prices.ts"), "utf8");
    expect(source).toContain('queryPipe<CommodityPrice>("prices_range"');
    expect(source).toContain("getPricesQueryParams");
    expect(source).toContain("filterPublicCommodityPrices");
    expect(source).not.toContain("latest_prices");
  });
});
