import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/lib/sitemap-document";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";
import { SITE_NAV_LINKS } from "@/components/site-public-nav";
import {
  catalogHrefs,
  hiddenNavHrefs,
  isIndexablePath,
  adjacentTabStop,
  menuKeyMotion,
  overlayMenuBox,
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
    expect(visibleNavHrefs()).toEqual([
      "/",
      "/gas",
      "/map",
      "/assets",
      "/system/constraints",
      "/power-cuts",
      "/system/storage",
      "/system/whole-energy",
      "/projects",
      "/pipeline",
      "/electricity/northern-ireland",
      "/directory",
      "/tools",
      "/changes",
      "/api",
    ]);
    expect(visibleHeaderNav().map((item) => item.label)).toEqual([
      "Today",
      "Gas",
      "Map",
      "Assets",
      "System",
      "Directory and tools",
      "Changes",
      "API",
    ]);
    expect(hiddenNavHrefs()).toEqual([
      "/system/generation",
      "/system/demand",
      "/system/carbon",
      "/system/transfers",
    ]);
    expect(SITE_NAV_CATALOG.map((item) => item.label)).toEqual([
      "Today",
      "Gas",
      "Map",
      "Assets",
      "System",
      "Directory and tools",
      "Changes",
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
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/gas");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/map");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/assets");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/system/constraints");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/system/storage");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/system/whole-energy");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/projects");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/pipeline");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/electricity/northern-ireland");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/directory");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/directory/identifiers");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/tools");
    expect(SITEMAP_PATHS.map((entry) => entry.path)).toContain("/changes");
    expect(urls).toContain("/api");
    expect(urls).toContain("/");
  });

  it("keeps an API link in the footer nav", () => {
    expect(SITE_NAV_LINKS).toContainEqual({ href: "/prices/gas", label: "Gas price" });
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

  it("clips a compact menu to the space beside the trigger", () => {
    const below = overlayMenuBox({
      trigger: { top: 108, bottom: 120, left: 40 },
      menuWidth: 200,
      viewportWidth: 375,
      viewportHeight: 700,
    });
    expect(below.top).toBe(124);
    expect(below.bottom).toBeNull();
    expect(below.maxHeight).toBe(700 - 120 - 4 - 8);
    expect(below.left).toBe(40);

    const flipped = overlayMenuBox({
      trigger: { top: 200, bottom: 232, left: 300 },
      menuWidth: 220,
      viewportWidth: 375,
      viewportHeight: 320,
    });
    expect(flipped.top).toBeNull();
    expect(flipped.bottom).toBe(320 - 200 + 4);
    expect(flipped.maxHeight).toBe(200 - 4 - 8);
    expect(flipped.left).toBe(375 - 220 - 8);
  });

  it("moves Tab to the header control beside the trigger", () => {
    const stops = ["search", "system", "changes"];
    expect(adjacentTabStop(stops, "system", false)).toBe("changes");
    expect(adjacentTabStop(stops, "system", true)).toBe("search");
    expect(adjacentTabStop(stops, "changes", false)).toBeNull();
    expect(adjacentTabStop(stops, "missing", false)).toBeNull();
  });
});
