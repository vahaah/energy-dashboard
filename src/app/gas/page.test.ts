import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("gas system page", () => {
  it("stays static for 900s and does not call Tinybird", () => {
    const page = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    const generation = readFileSync(resolve(process.cwd(), "src/lib/gas/generation.ts"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 900");
    expect(page).toContain("getGasReleaseReader");
    expect(page).toContain("loadWarmedGasGeneration");
    expect(page).not.toContain("queryPipe");
    expect(generation).toContain("peekWarmedPipe");
    expect(generation).not.toContain("queryPipe");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(home).not.toContain("@/lib/gas/");
    expect(home).not.toContain("national-gas");
    expect(home).not.toContain("queryPipe");
  });
});
