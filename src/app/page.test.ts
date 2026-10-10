import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("homepage", () => {
  it("server-renders the SEO briefing from the cached dashboard payload", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("loadHomepagePayload");
    expect(source).toContain("HomepageBriefing");
    expect(source).toContain("homepageJsonLd");
    expect(source).toContain("export const revalidate = 300");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain('canonical: "/"');
    expect(source).toContain("SITE_OG_IMAGE");
    expect(source).toContain("SITE_OG_TYPE");
    expect(source).toContain("SITE_TWITTER_CARD");
    expect(source).toContain("{briefing}</Dashboard>");
    expect(source).not.toContain("generateMetadata");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("loadDashboardSearchParams");
    expect(source).not.toContain("/og?focus=");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("No data yet");
  });
});
