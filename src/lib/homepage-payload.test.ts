import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("homepage payload", () => {
  it("reuses the cached dashboard payload and does not add a Tinybird pipe", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./homepage-payload.ts"), "utf8");
    expect(source).toContain("loadDashboardPayload");
    expect(source).toContain('period: "day"');
    expect(source).toContain("/api/dashboard?period=day");
    expect(source).not.toContain("queryPipe");
  });
});
