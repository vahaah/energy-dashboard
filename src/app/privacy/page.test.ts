import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("legal pages", () => {
  it("states UK GDPR controller, contact, and no-account collection", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("privacyPageMetadata");
    expect(source).toContain("LEGAL_CONTROLLER");
    expect(source).toContain("LEGAL_CONTACT_EMAIL");
    expect(source).toContain("no accounts");
    expect(source).toContain("UK GDPR");
    expect(source).toContain("Vercel platform logs");
    expect(source).toContain("does not show a cookie banner");
    expect(source).toContain("cookieless");
    expect(source).toContain("does not collect personal data");
    expect(source).toContain("EU-hosted");
    expect(source).toContain("https://plausible.io/data-policy");
    expect(source).toContain("Plausible&apos;s data policy");
    expect(source).toContain("The counting window is one minute");
    expect(source).toContain("the IP entry is dropped");
  });

  it("keeps terms informational, MIT, and not financial advice", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/terms/page.tsx"), "utf8");
    expect(source).toContain("termsPageMetadata");
    expect(source).toContain("Not financial advice");
    expect(source).toContain("No warranty");
    expect(source).not.toContain("CODE_LICENCE");
    expect(source).not.toContain("MIT");
    expect(source).toContain("Data sources");
    expect(source).toContain("Liability");
  });

  it("lists every attribution catalogue source on /data-sources", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/data-sources/page.tsx"), "utf8");
    expect(source).toContain("dataSourcesPageMetadata");
    expect(source).toContain("cataloguePageSources()");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("/attributions redirects here");
  });
});
