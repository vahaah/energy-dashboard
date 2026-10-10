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
    expect(source).toContain("Days since coal power ended");
    expect(source).not.toContain("Days without coal");
    expect(source).not.toContain("1 MW of coal");
    expect(source).toContain("Ratcliffe-on-Soar");
    expect(source).toContain("COAL_POWER_ENDED_SOURCE");
    expect(source).toContain("emptyRecordsWithDocumentedCoal");
    expect(source).not.toContain("100 MW or 0.5%");
    expect(
      readFileSync(resolve(import.meta.dirname, "../../components/records-card.tsx"), "utf8")
    ).toContain("Days since coal power ended");
  });
});
