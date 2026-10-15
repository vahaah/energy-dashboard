import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STORAGE_H1, STORAGE_STANDFIRST, STORAGE_TITLE } from "@/lib/storage/copy";

describe("storage page", () => {
  it("stays static for 1800s and reads the warmed electricity snapshot", () => {
    const page = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    const load = readFileSync(resolve(process.cwd(), "src/lib/storage/load.ts"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 1800");
    const copy = readFileSync(resolve(process.cwd(), "src/lib/storage/copy.ts"), "utf8");
    expect(page).toContain("STORAGE_TITLE");
    expect(page).toContain("STORAGE_H1");
    expect(page).toContain("STORAGE_STANDFIRST");
    expect(copy).toContain(STORAGE_TITLE);
    expect(copy).toContain(STORAGE_H1);
    expect(copy).toContain(STORAGE_STANDFIRST);
    expect(page).toContain("loadWarmedStorageGeneration");
    expect(page).not.toContain("queryPipe");
    expect(load).toContain("peekWarmedPipe");
    expect(load).toContain("generation_5min_range");
    expect(load).not.toContain("queryPipe");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(home).not.toContain("@/lib/storage/");
    expect(home).not.toContain("queryPipe");
    expect(page).not.toMatch(/\b(live|real-time|right now)\b/i);
    expect(page).not.toMatch(/\bUK\b/);
  });
});
