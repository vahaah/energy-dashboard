import { SYSTEM_NAV_ITEMS } from "@/lib/nav";

export type SiteNavLink = {
  kind: "link";
  id: string;
  label: string;
  href: string;
};

export type SiteNavMenuItem = {
  id: string;
  label: string;
  href: string;
};

export type SiteNavMenu = {
  kind: "menu";
  id: string;
  label: string;
  items: SiteNavMenuItem[];
};

export type SiteNavEntry = SiteNavLink | SiteNavMenu;

/**
 * Header order: Today, Gas, Map, Assets, System, Directory and tools, API.
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
  { kind: "link", id: "directory", label: "Directory and tools", href: "/directory" },
  { kind: "link", id: "api", label: "API", href: "/api" },
];

/** Static App Router pages. Keep this aligned with src/app star-slash page.tsx files. */
export const SHIPPED_PAGE_ROUTES = [
  "/",
  "/api",
  "/assets",
  "/data-health",
  "/data-sources",
  "/explained/price-cap",
  "/gas",
  "/map",
  "/system/constraints",
  "/system/whole-energy",
  "/methodology",
  "/prices/gas",
  "/privacy",
  "/records",
  "/system/storage",
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
