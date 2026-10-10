import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("today page", () => {
  it("is static ISR, reuses cached dashboard payloads, and has no Tinybird call", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("export const revalidate = 3600");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("todayPageMetadata");
    expect(source).toContain("loadDashboardPayload");
    expect(source).toContain('period: "day"');
    expect(source).toContain('period: "week"');
    expect(source).toContain("todayJsonLd");
    expect(source).toContain("data-cite");
    expect(source).toContain("SiteFaq");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("No data yet");
    expect(source).not.toMatch(/\blive\b/);
    expect(source).not.toContain("real-time");
  });
});
