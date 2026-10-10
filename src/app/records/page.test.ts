import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("records page", () => {
  it("is indexable with Dataset and FAQ schema and NESO credit", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    const jsonld = readFileSync(resolve(import.meta.dirname, "../../lib/jsonld.ts"), "utf8");
    expect(source).toContain("JsonLd");
    expect(source).toContain("recordsJsonLd");
    expect(jsonld).toContain("Dataset");
    expect(jsonld).toContain("FAQPage");
    expect(jsonld).toContain("CC_BY_4_0_LICENSE_URL");
    expect(jsonld).toContain("APP_ID");
    expect(source).toContain("NESO_OPEN_DATA_ATTRIBUTION");
    expect(source).toContain("export const revalidate = 86_400");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("First time above N GW");
    expect(source).toContain("Days since coal power ended");
    expect(source).toContain("since Grid's records began");
    expect(source).toContain("HIDE_SOLAR_RECORD");
    expect(source).toContain("formatNesoOfficialLine");
    expect(source).toContain('canonical: "/records"');
    expect(source).toContain("SITE_OG_TYPE");
    expect(source).toContain("SITE_TWITTER_CARD");
    expect(source).toContain("twitter:");
    expect(source).toContain("15.4 GW");
    expect(source).not.toContain("15,158");
    expect(source).not.toContain("Days without coal");
    expect(source).not.toContain("1 MW of coal");
    expect(source).toContain("Ratcliffe-on-Soar");
    expect(source).toContain("COAL_POWER_ENDED_SOURCE");
    expect(source).toContain("emptyRecordsWithDocumentedCoal");
    expect(source).not.toContain("100 MW or 0.5%");
    expect(source).not.toContain("live dashboard");
    expect(source).toContain("SiteLegalNav");
    expect(source).toContain("PAGE_STACK_CLASS");
    expect(source).toContain("CARD_GRID_CLASS");
    expect(source).toContain("<Card");
    expect(source).toContain('size="stat"');
    expect(source).not.toContain("surface-card");
    expect(source).not.toContain("gap-12");
    expect(
      readFileSync(resolve(import.meta.dirname, "../../components/records-card.tsx"), "utf8")
    ).toContain("Days since coal power ended");
  });
});
