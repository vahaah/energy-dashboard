import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function pipeSource(name: string): string {
  return readFileSync(resolve(process.cwd(), "tinybird/pipes", `${name}.pipe`), "utf8");
}

describe("tinybird pipes stay deploy-valid and deterministic", () => {
  it("uses FINAL instead of any(price) for commodity history", () => {
    const source = pipeSource("prices_range");

    expect(source).toContain("FROM commodity_prices AS p FINAL");
    expect(source).not.toMatch(/any\s*\(\s*price\s*\)/);
    expect(source).toContain("p.price");
  });

  it("collapses latest_prices with FINAL before argMax on the date column", () => {
    const source = pipeSource("latest_prices");

    expect(source).toContain("FROM commodity_prices AS p FINAL");
    expect(source).toContain("argMax(p.price, p.date)");
    expect(source).not.toMatch(/argMax\([^)]*,\s*date\s*\)/);
  });

  it("ignores future generation timestamps and does not shadow timestamp in argMax", () => {
    const source = pipeSource("latest_generation");

    expect(source).toContain("FROM generation_5min AS g");
    expect(source).toContain("WHERE g.timestamp <= now()");
    expect(source).toContain("argMax(g.generation_mw, g.timestamp)");
    expect(source).not.toMatch(/argMax\([^)]*,\s*timestamp\s*\)/);
  });

  it("collapses FUELINST keys with FINAL before hour and day averages", () => {
    const source = pipeSource("generation_5min_range");

    expect(source).toContain("FROM generation_5min FINAL");
    expect(source).toContain("toStartOfHour(timestamp)");
    expect(source).toContain("toStartOfDay(timestamp)");
    expect(source).not.toMatch(/any\s*\(\s*generation_mw\s*\)/);
  });

  it("picks the latest snapshot that has core settled fields", () => {
    const source = pipeSource("latest_snapshot");

    expect(source).toContain("FROM energy_snapshots AS s FINAL");
    expect(source).toContain("s.timestamp <= now()");
    expect(source).toContain("s.demand_mw IS NOT NULL");
    expect(source).toContain("s.price_gbp_mwh IS NOT NULL");
  });
});
