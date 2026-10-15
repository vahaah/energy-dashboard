import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SitePrimaryNav } from "@/components/site-primary-nav";

describe("primary nav", () => {
  it("marks the active route with aria-current and omits hidden routes", () => {
    const home = renderToStaticMarkup(<SitePrimaryNav pathname="/" idPrefix="test" />);
    expect(home).toMatch(/<a[^>]*aria-current="page"[^>]*>Today<\/a>/);
    expect(home).toMatch(/<a[^>]*href="\/map"[^>]*>Map<\/a>/);
    expect(home).toMatch(/<a[^>]*href="\/assets"[^>]*>Assets<\/a>/);
    expect(home).toMatch(/<a[^>]*href="\/api"[^>]*>API<\/a>/);
    expect(home.match(/aria-current="page"/g)?.length).toBe(1);
    expect(home).not.toContain(">System<");
    expect(home).not.toContain("Directory and tools");
    expect(home).not.toContain('href="/directory"');

    const api = renderToStaticMarkup(<SitePrimaryNav pathname="/api" idPrefix="test" />);
    expect(api).toMatch(/<a[^>]*aria-current="page"[^>]*>API<\/a>/);
    expect(api.match(/aria-current="page"/g)?.length).toBe(1);
    expect(api).not.toMatch(/<a[^>]*aria-current="page"[^>]*>Today<\/a>/);

    const map = renderToStaticMarkup(<SitePrimaryNav pathname="/map" idPrefix="test" />);
    expect(map).toMatch(/<a[^>]*aria-current="page"[^>]*>Map<\/a>/);
    expect(map.match(/aria-current="page"/g)?.length).toBe(1);
  });

  it("exposes a keyboard menu button when a system route is rendered", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./site-primary-nav.tsx"), "utf8");
    expect(source).toContain('aria-haspopup="menu"');
    expect(source).toContain("aria-expanded");
    expect(source).toContain('role="menu"');
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("menuKeyMotion");
    expect(source).toContain("ChevronDown");
  });
});
