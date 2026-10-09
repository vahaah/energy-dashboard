import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("records page", () => {
  it("is indexable with Dataset and FAQ schema and NESO credit", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("application/ld+json");
    expect(source).toContain("Dataset");
    expect(source).toContain("FAQPage");
    expect(source).toContain("NESO_OPEN_DATA_ATTRIBUTION");
    expect(source).toContain("export const revalidate = 86_400");
    expect(source).toContain("First time above N GW");
  });
});
