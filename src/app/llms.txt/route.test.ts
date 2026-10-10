import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("llms.txt route", () => {
  it("is text/plain ISR from the homepage payload", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./route.ts"), "utf8");
    expect(source).toContain("loadHomepagePayload");
    expect(source).toContain("buildLlmsTxt");
    expect(source).toContain("text/plain");
    expect(source).toContain("export const revalidate = LLMS_TXT_REVALIDATE_SECONDS");
    expect(source).not.toContain("queryPipe");
  });
});
