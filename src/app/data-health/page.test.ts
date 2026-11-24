import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("data health page", () => {
  it("renders from warmed envelopes and leaves the homepage static", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(source).toContain("loadDataHealth");
    expect(source).toContain("DataHealthReading");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("export const revalidate = 300");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("fetchPipeRows");
    expect(home).toContain('export const dynamic = "force-static"');
  });
});
