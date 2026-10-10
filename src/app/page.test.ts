import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("homepage", () => {
  it("server-renders the SEO briefing from the cached dashboard payload", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("loadHomepagePayload");
    expect(source).toContain("HomepageBriefing");
    expect(source).toContain("homepageJsonLd");
    expect(source).toContain("export const revalidate = 3600");
    expect(source).toContain('canonical: "/"');
    expect(source).toContain("SITE_OG_IMAGE");
    expect(source).toContain("SITE_TWITTER_CARD");
    expect(source).toContain("isLatestDashboardDate");
    expect(source).toContain("{briefing}</Dashboard>");
    expect(source).toContain("searchParams");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("No data yet");
  });
});
