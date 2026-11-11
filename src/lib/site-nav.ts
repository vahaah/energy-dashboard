import { SYSTEM_NAV_ITEMS } from "@/lib/nav";

export type SiteNavLink = {
  kind: "link";
  id: string;
  label: string;
  /** Short header label below the md breakpoint. */
  compactLabel?: string;
  href: string;
};

export type SiteNavMenuItem = {
  id: string;
  label: string;
  href: string;
  dividerBefore?: string;
};

export type SiteNavMenu = {
  kind: "menu";
  id: string;
  label: string;
  /** Short header label below the md breakpoint. */
  compactLabel?: string;
  items: SiteNavMenuItem[];
};

export type SiteNavEntry = SiteNavLink | SiteNavMenu;

/**
 * Header order: Today, Gas, Map, Assets, System, Directory and tools, Changes, API.
 * An item renders only when its page module is in SHIPPED_PAGE_ROUTES.
 */
export const SITE_NAV_CATALOG: SiteNavEntry[] = [
  { kind: "link", id: "today", label: "Today", href: "/" },
  { kind: "link", id: "gas", label: "Gas", href: "/gas" },
  { kind: "link", id: "map", label: "Map", href: "/map" },
  { kind: "link", id: "assets", label: "Assets", href: "/assets" },
  {
    kind: "menu",
    id: "system",
    label: "System",
    items: SYSTEM_NAV_ITEMS.map((item) => ({ ...item })),
  },
  {
    kind: "menu",
    id: "directory",
    label: "Directory and tools",
    compactLabel: "Directory",
    items: [
      { id: "directory", label: "Directory", href: "/directory" },
      { id: "tools", label: "Tools", href: "/tools" },
    ],
  },
  { kind: "link", id: "changes", label: "Changes", href: "/changes" },
  { kind: "link", id: "api", label: "API", href: "/api" },
];

/** Static App Router pages. Keep this aligned with src/app star-slash page.tsx files. */
export const SHIPPED_PAGE_ROUTES = [
  "/",
  "/api",
  "/assets",
  "/data-health",
  "/data-sources",
  "/directory",
  "/directory/identifiers",
  "/tools",
  "/changes",
  "/explained/price-cap",
  "/gas",
  "/map",
  "/system/constraints",
  "/system/balancing",
  "/power-cuts",
  "/system/whole-energy",
  "/methodology",
  "/prices/gas",
  "/privacy",
  "/records",
  "/system/storage",
  "/pipeline",
  "/projects",
  "/electricity/northern-ireland",
  "/terms",
  "/today",
] as const;

const SHIPPED = new Set<string>(SHIPPED_PAGE_ROUTES);

export function routeExists(href: string): boolean {
  return SHIPPED.has(href);
}

export function catalogHrefs(catalog: SiteNavEntry[] = SITE_NAV_CATALOG): string[] {
  const hrefs: string[] = [];
  for (const entry of catalog) {
    switch (entry.kind) {
      case "link":
        hrefs.push(entry.href);
        break;
      case "menu":
        for (const item of entry.items) {
          hrefs.push(item.href);
        }
        break;
      default: {
        const exhaustive: never = entry;
        return exhaustive;
      }
    }
  }
  return hrefs;
}

export function hiddenNavHrefs(catalog: SiteNavEntry[] = SITE_NAV_CATALOG): string[] {
  return catalogHrefs(catalog).filter((href) => !routeExists(href));
}

export function visibleHeaderNav(catalog: SiteNavEntry[] = SITE_NAV_CATALOG): SiteNavEntry[] {
  const visible: SiteNavEntry[] = [];
  for (const entry of catalog) {
    switch (entry.kind) {
      case "link":
        if (routeExists(entry.href)) {
          visible.push(entry);
        }
        break;
      case "menu": {
        const items = entry.items.filter((item) => routeExists(item.href));
        if (items.length > 0) {
          visible.push({ ...entry, items });
        }
        break;
      }
      default: {
        const exhaustive: never = entry;
        return exhaustive;
      }
    }
  }
  return visible;
}

export function compactNavLabel(entry: SiteNavEntry): string {
  return entry.compactLabel ?? entry.label;
}

/** The mobile section line repeats the compact nav when the strings match. */
export function sectionRepeatsCompactNav(section: string, catalog: SiteNavEntry[] = SITE_NAV_CATALOG): boolean {
  return visibleHeaderNav(catalog).some((entry) => compactNavLabel(entry) === section);
}

export function visibleNavHrefs(catalog: SiteNavEntry[] = SITE_NAV_CATALOG): string[] {
  return catalogHrefs(visibleHeaderNav(catalog));
}

export function isNavCurrent(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isIndexablePath(path: string): boolean {
  if (path === "/llms.txt") {
    return true;
  }
  return routeExists(path === "" ? "/" : path);
}

const MENU_GUTTER = 8;
const MENU_GAP = 4;
const MENU_MIN_SIDE = 160;

export type OverlayMenuBox = {
  top: number | null;
  bottom: number | null;
  left: number;
  maxHeight: number;
};

/** Place a portalled menu in the larger side of the trigger, clipped to the viewport. */
export function overlayMenuBox(input: {
  trigger: { top: number; bottom: number; left: number };
  menuWidth: number;
  viewportWidth: number;
  viewportHeight: number;
}): OverlayMenuBox {
  const { trigger, menuWidth, viewportWidth, viewportHeight } = input;
  const below = viewportHeight - trigger.bottom - MENU_GAP - MENU_GUTTER;
  const above = trigger.top - MENU_GAP - MENU_GUTTER;
  const placeAbove = below < MENU_MIN_SIDE && above > below;
  const maxLeft = Math.max(MENU_GUTTER, viewportWidth - menuWidth - MENU_GUTTER);
  const left = Math.min(Math.max(MENU_GUTTER, trigger.left), maxLeft);
  if (placeAbove) {
    return {
      top: null,
      bottom: viewportHeight - trigger.top + MENU_GAP,
      left,
      maxHeight: Math.max(0, above),
    };
  }
  return {
    top: trigger.bottom + MENU_GAP,
    bottom: null,
    left,
    maxHeight: Math.max(0, below),
  };
}

/** Next or previous tab stop relative to the menu trigger, skipping the open menu. */
export function adjacentTabStop<T>(stops: readonly T[], trigger: T, backward: boolean): T | null {
  const index = stops.indexOf(trigger);
  if (index < 0) {
    return null;
  }
  return stops[backward ? index - 1 : index + 1] ?? null;
}

export type MenuKeyTarget = "button" | "item";

export type MenuMotion =
  | { type: "open"; index: number }
  | { type: "close"; restore: boolean }
  | { type: "move"; index: number }
  | { type: "none" };

export function menuKeyMotion(input: {
  key: string;
  open: boolean;
  index: number;
  length: number;
  target: MenuKeyTarget;
}): MenuMotion {
  const { key, open, index, length, target } = input;
  if (length <= 0) {
    return { type: "none" };
  }
  if (!open) {
    if (target !== "button") {
      return { type: "none" };
    }
    if (key === "ArrowDown" || key === "Enter" || key === " ") {
      return { type: "open", index: 0 };
    }
    if (key === "ArrowUp") {
      return { type: "open", index: length - 1 };
    }
    return { type: "none" };
  }
  switch (key) {
    case "ArrowDown":
      return { type: "move", index: (index + 1) % length };
    case "ArrowUp":
      return { type: "move", index: (index - 1 + length) % length };
    case "Home":
      return { type: "move", index: 0 };
    case "End":
      return { type: "move", index: length - 1 };
    case "Escape":
      return { type: "close", restore: true };
    case "Tab":
      return { type: "close", restore: false };
    default:
      return { type: "none" };
  }
}
