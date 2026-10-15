export const BREAKDOWN_CATEGORIES = [
  "reducing_largest_loss",
  "increasing_system_inertia",
  "voltage",
  "thermal",
] as const;

export type BreakdownCategory = (typeof BREAKDOWN_CATEGORIES)[number];

export const BREAKDOWN_CATEGORY_LABEL: Record<BreakdownCategory, string> = {
  reducing_largest_loss: "Reducing largest loss",
  increasing_system_inertia: "Increasing system inertia",
  voltage: "Voltage constraints",
  thermal: "Thermal constraints",
};

/** Existing chart tokens. No new palette. */
export const BREAKDOWN_CATEGORY_COLOR: Record<BreakdownCategory, string> = {
  reducing_largest_loss: "var(--chart-nuclear)",
  increasing_system_inertia: "var(--chart-hydro)",
  voltage: "var(--chart-solar)",
  thermal: "var(--chart-other)",
};

export const BREAKDOWN_HEADER = [
  "Date",
  "Reducing largest loss cost",
  "Increasing system inertia cost",
  "Voltage constraints cost",
  "Thermal constraints cost",
  "Reducing largest loss volume",
  "Increasing system inertia volume",
  "Voltage constraints volume",
  "Thermal constraints volume",
] as const;

const COST_INDEX: Record<BreakdownCategory, number> = {
  reducing_largest_loss: 1,
  increasing_system_inertia: 2,
  voltage: 3,
  thermal: 4,
};

const VOLUME_INDEX: Record<BreakdownCategory, number> = {
  reducing_largest_loss: 5,
  increasing_system_inertia: 6,
  voltage: 7,
  thermal: 8,
};

export function breakdownCostIndex(category: BreakdownCategory): number {
  return COST_INDEX[category];
}

export function breakdownVolumeIndex(category: BreakdownCategory): number {
  return VOLUME_INDEX[category];
}

export function isBreakdownCategory(value: string): value is BreakdownCategory {
  return (BREAKDOWN_CATEGORIES as readonly string[]).includes(value);
}
