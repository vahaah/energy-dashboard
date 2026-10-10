import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("API docs page", () => {
  it("documents public JSON without a new Tinybird pipe", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("apiDocsPageMetadata");
    expect(source).toContain("apiDocsJsonLd");
    expect(source).toContain("loadHomepagePayload");
    expect(source).toContain("/api/snapshots?range=24h");
    expect(source).toContain("60 requests");
    expect(source).toContain("CC BY 4.0");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toMatch(/\bTTF\b/);
  });
});
