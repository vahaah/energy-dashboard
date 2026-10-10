import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("methodology page", () => {
  it("holds the source table, records definition and citation", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("methodologyPageMetadata");
    expect(source).toContain("dataSources()");
    expect(source).toContain("since Grid");
    expect(source).toContain("How should I cite Grid?");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).not.toContain("queryPipe");
  });
});
