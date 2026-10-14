import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";
import { SITE_NAV_LINKS } from "@/components/site-public-nav";
import {
  catalogHrefs,
  hiddenNavHrefs,
  isIndexablePath,
  menuKeyMotion,
  routeExists,
  SHIPPED_PAGE_ROUTES,
  SITE_NAV_CATALOG,
  visibleHeaderNav,
  visibleNavHrefs,
} from "@/lib/site-nav";

function discoverStaticPages(dir = resolve(process.cwd(), "src/app"), prefix = ""): string[] {
  const pages: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("[") || entry.startsWith("(")) {
        continue;
      }
      pages.push(...discoverStaticPages(full, `${prefix}/${entry}`));
      continue;
    }
    if (entry === "page.tsx") {
      pages.push(prefix === "" ? "/" : prefix);
    }
  }
  return pages;
}

describe("site nav shell", () => {
  it("renders only catalog items whose pages exist", () => {
    const discovered = discoverStaticPages().sort();
    expect([...SHIPPED_PAGE_ROUTES].sort()).toEqual(discovered);
    for (const href of catalogHrefs()) {
      expect(routeExists(href)).toBe(discovered.includes(href));
    }
    expect(visibleNavHrefs()).toEqual(["/", "/api"]);
    expect(visibleHeaderNav().map((item) => item.label)).toEqual(["Today", "API"]);
    expect(hiddenNavHrefs()).toEqual([
      "/map",
      "/system/generation",
      "/system/demand",
      "/system/carbon",
      "/system/transfers",
      "/directory",
    ]);
    expect(SITE_NAV_CATALOG.map((item) => item.label)).toEqual([
      "Today",
      "Map",
      "System",
      "Directory and tools",
      "API",
    ]);
  });

  it("keeps hidden routes out of the nav and the sitemap", async () => {
    const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    const nav = visibleNavHrefs();
    for (const href of hiddenNavHrefs()) {
      expect(nav).not.toContain(href);
      expect(urls).not.toContain(href);
      expect(isIndexablePath(href)).toBe(false);
    }
    expect(SITEMAP_PATHS.map((entry) => entry.path)).not.toContain("/map");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).not.toContain("/directory");
    expect(urls).toContain("/api");
    expect(urls).toContain("/");
  });

  it("keeps an API link in the footer nav", () => {
    expect(SITE_NAV_LINKS).toContainEqual({ href: "/api", label: "API" });
    expect(SITE_NAV_LINKS).toContainEqual({ href: "/data-health", label: "Data health" });
    expect(visibleNavHrefs()).not.toContain("/data-health");
    expect(routeExists("/data-health")).toBe(true);
  });

  it("moves a keyboard menu without trapping Tab", () => {
    expect(menuKeyMotion({ key: "ArrowDown", open: false, index: 0, length: 3, target: "button" })).toEqual({
      type: "open",
      index: 0,
    });
    expect(menuKeyMotion({ key: "ArrowUp", open: false, index: 0, length: 3, target: "button" })).toEqual({
      type: "open",
      index: 2,
    });
    expect(menuKeyMotion({ key: "ArrowDown", open: true, index: 2, length: 3, target: "item" })).toEqual({
      type: "move",
      index: 0,
    });
    expect(menuKeyMotion({ key: "Home", open: true, index: 2, length: 3, target: "item" })).toEqual({
      type: "move",
      index: 0,
    });
    expect(menuKeyMotion({ key: "End", open: true, index: 0, length: 3, target: "item" })).toEqual({
      type: "move",
      index: 2,
    });
    expect(menuKeyMotion({ key: "Escape", open: true, index: 1, length: 3, target: "item" })).toEqual({
      type: "close",
      restore: true,
    });
    expect(menuKeyMotion({ key: "Tab", open: true, index: 1, length: 3, target: "item" })).toEqual({
      type: "close",
      restore: false,
    });
    expect(menuKeyMotion({ key: "ArrowDown", open: false, index: 0, length: 0, target: "button" })).toEqual({
      type: "none",
    });
  });
});
