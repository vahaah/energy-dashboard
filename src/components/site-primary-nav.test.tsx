import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SitePrimaryNav } from "@/components/site-primary-nav";

describe("primary nav", () => {
  it("marks the active route with aria-current and omits hidden routes", () => {
    const home = renderToStaticMarkup(<SitePrimaryNav pathname="/" idPrefix="test" />);
    expect(home).toMatch(/<a[^>]*aria-current="page"[^>]*>Today<\/a>/);
    expect(home).toMatch(/<a[^>]*href="\/gas"[^>]*>Gas<\/a>/);
    expect(home.indexOf(">Today<")).toBeLessThan(home.indexOf(">Gas<"));
    expect(home.indexOf(">Gas<")).toBeLessThan(home.indexOf(">Map<"));
    expect(home).toMatch(/<a[^>]*href="\/map"[^>]*>Map<\/a>/);
    expect(home).toMatch(/<a[^>]*href="\/assets"[^>]*>Assets<\/a>/);
    expect(home).toMatch(/<a[^>]*href="\/api"[^>]*>API<\/a>/);
    expect(home.match(/aria-current="page"/g)?.length).toBe(1);
    expect(home).toContain(">System<");
    expect(home).not.toContain('href="/system/constraints"');
    expect(home).not.toContain('href="/system/storage"');
    expect(home).not.toContain('href="/system/whole-energy"');
    expect(home).not.toContain('href="/system/generation"');
    expect(home).not.toContain('href="/system/demand"');
    expect(home).not.toContain('href="/system/carbon"');
    expect(home).not.toContain('href="/system/transfers"');
    expect(home).toContain("Directory and tools");
    expect(home).toContain('href="/directory"');
    expect(home.indexOf(">Assets<")).toBeLessThan(home.indexOf("Directory and tools"));
    expect(home.indexOf("Directory and tools")).toBeLessThan(home.indexOf(">API<"));

    const directory = renderToStaticMarkup(<SitePrimaryNav pathname="/directory/identifiers" idPrefix="test" />);
    expect(directory).toMatch(/<a[^>]*aria-current="page"[^>]*>Directory and tools<\/a>/);

    const compact = renderToStaticMarkup(<SitePrimaryNav pathname="/directory" idPrefix="test" compact />);
    expect(compact).toContain(">Directory<");
    expect(compact).not.toContain("Directory and tools");
    expect(compact).toMatch(/<a[^>]*aria-current="page"[^>]*>Directory<\/a>/);

    const api = renderToStaticMarkup(<SitePrimaryNav pathname="/api" idPrefix="test" />);
    expect(api).toMatch(/<a[^>]*aria-current="page"[^>]*>API<\/a>/);
    expect(api.match(/aria-current="page"/g)?.length).toBe(1);
    expect(api).not.toMatch(/<a[^>]*aria-current="page"[^>]*>Today<\/a>/);

    const gas = renderToStaticMarkup(<SitePrimaryNav pathname="/gas" idPrefix="test" />);
    expect(gas).toMatch(/<a[^>]*aria-current="page"[^>]*>Gas<\/a>/);
    expect(gas.match(/aria-current="page"/g)?.length).toBe(1);

    const map = renderToStaticMarkup(<SitePrimaryNav pathname="/map" idPrefix="test" />);
    expect(map).toMatch(/<a[^>]*aria-current="page"[^>]*>Map<\/a>/);
    expect(map.match(/aria-current="page"/g)?.length).toBe(1);

    const storage = renderToStaticMarkup(<SitePrimaryNav pathname="/system/storage" idPrefix="test" />);
    expect(storage).toContain(">System<");
    expect(storage).toContain('aria-current="page"');
    expect(storage.match(/aria-current="page"/g)?.length).toBe(1);
    expect(storage).not.toMatch(/<a[^>]*aria-current="page"[^>]*>Today<\/a>/);
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
