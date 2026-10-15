export type SystemNavItem = {
  id: string;
  label: string;
  href: string;
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
  { id: "storage", label: "Storage", href: "/system/storage" },
  { id: "whole-energy", label: "Whole energy", href: "/system/whole-energy" },
];
