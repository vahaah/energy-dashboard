import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BALANCING_H1, BALANCING_TITLE, TRADE_LABEL } from "@/lib/balancing/copy";

describe("balancing page", () => {
  it("stays static, carries the trade label, and does not call Tinybird", () => {
    const source = readFileSync(join(process.cwd(), "src/app/system/balancing/page.tsx"), "utf8");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("export const revalidate = 86400");
    expect(source).toContain("BALANCING_TITLE");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("maplibre");
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(BALANCING_TITLE).toContain("Grid");
    expect(BALANCING_H1.length).toBeGreaterThan(10);
    expect(TRADE_LABEL).toContain("Market index price (Elexon MID)");
    expect(home).toContain("readBalancingRelease");
  });
});
