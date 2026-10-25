import { NI_NAV_LABEL, NI_OUTSIDE_GB, NI_PATH } from "@/lib/eirgrid/copy";

export type SystemNavItem = {
  id: string;
  label: string;
  href: string;
  /** Label rendered above this item. Not a link. */
  dividerBefore?: string;
};

/**
 * System dropdown. An item renders only when its href is in SHIPPED_PAGE_ROUTES.
 * Later pages add one object to this array.
 */
export const SYSTEM_NAV_ITEMS: readonly SystemNavItem[] = [
  { id: "generation", label: "Generation", href: "/system/generation" },
  { id: "demand", label: "Demand", href: "/system/demand" },
  { id: "carbon", label: "Carbon", href: "/system/carbon" },
  { id: "transfers", label: "Transfers", href: "/system/transfers" },
  { id: "constraints", label: "Constraints", href: "/system/constraints" },
  { id: "power-cuts", label: "Power cuts", href: "/power-cuts" },
  { id: "storage", label: "Storage", href: "/system/storage" },
  { id: "whole-energy", label: "Whole energy", href: "/system/whole-energy" },
  { id: "projects", label: "Projects", href: "/projects" },
  { id: "pipeline", label: "Pipeline", href: "/pipeline" },
  { id: "northern-ireland", label: NI_NAV_LABEL, href: NI_PATH, dividerBefore: NI_OUTSIDE_GB },
];
