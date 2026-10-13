import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_NAV_LINKS } from "@/components/site-legal-nav";

describe("legal nav", () => {
  it("links privacy, terms, and data sources from the dashboard and records footers", () => {
    expect(LEGAL_NAV_LINKS.map((link) => link.href)).toEqual([
      "/privacy",
      "/terms",
      "/data-sources",
    ]);

    const dashboard = readFileSync(resolve(import.meta.dirname, "./dashboard.tsx"), "utf8");
    const generationDesk = readFileSync(resolve(import.meta.dirname, "./generation-desk.tsx"), "utf8");
    const records = readFileSync(resolve(process.cwd(), "src/app/records/page.tsx"), "utf8");
    const config = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(dashboard).toContain("SiteLegalNav");
    expect(dashboard).toContain("SitePublicNav");
    expect(dashboard).toContain('href="/methodology"');
    expect(dashboard).not.toContain("history.replaceState");
    expect(dashboard).not.toContain("URL state is canonical");
    expect(generationDesk).toContain("captionGeneration(neso)");
    expect(dashboard).toContain("captionGeneration(isNesoPeriod(mixPeriod))");
    expect(dashboard).toContain("shareFocusPath(focus)");
    expect(dashboard).not.toContain("window.location.href");
    expect(dashboard).toContain("captionElexon()");
    expect(dashboard).toContain("captionTransfers(");
    expect(dashboard).toContain("captionCommodities()");
    expect(dashboard).toContain("captionNeso()");
    expect(dashboard).toContain("captionCarbon(isNesoPeriod(carbonPeriod))");
    expect(records).toContain("SiteLegalNav");
    expect(config).toContain('source: "/attributions"');
    expect(config).toContain('destination: "/data-sources"');
  });
});
