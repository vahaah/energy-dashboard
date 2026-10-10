import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("share focus pages", () => {
  it("is a static per-section landing with focused OG and a homepage canonical", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    expect(source).toContain("generateStaticParams");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("export const dynamicParams = false");
    expect(source).toContain("sharePageMetadata");
    expect(source).toContain("ShareFocusRedirect");
    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("loadDashboardSearchParams");
  });
});
