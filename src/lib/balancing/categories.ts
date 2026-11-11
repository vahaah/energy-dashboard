export const BALANCING_CATEGORIES = [
  "energy_imbalance",
  "frequency_control",
  "positive_reserve",
  "negative_reserve",
  "constraints",
  "other",
] as const;

export type BalancingCategory = (typeof BALANCING_CATEGORIES)[number];

export type CategoryPence = Record<BalancingCategory, number>;

export const BALANCING_CATEGORY_LABEL: Record<BalancingCategory, string> = {
  energy_imbalance: "Energy imbalance",
  frequency_control: "Frequency control",
  positive_reserve: "Positive reserve",
  negative_reserve: "Negative reserve",
  constraints: "Constraints",
  other: "Other",
};

/** NESO datastore column. The same six names are on every financial-year file from 2017-2018. */
export const NESO_COST_COLUMN: Record<BalancingCategory, string> = {
  energy_imbalance: "Energy Imbalance",
  frequency_control: "Frequency Control",
  positive_reserve: "Positive Reserve",
  negative_reserve: "Negative Reserve",
  constraints: "Constraints",
  other: "Other",
};

export const BALANCING_CATEGORY_COLOR: Record<BalancingCategory, string> = {
  energy_imbalance: "var(--chart-balancing-imbalance)",
  frequency_control: "var(--chart-balancing-frequency)",
  positive_reserve: "var(--chart-balancing-positive)",
  negative_reserve: "var(--chart-balancing-negative)",
  constraints: "var(--chart-balancing-constraints)",
  other: "var(--chart-balancing-other)",
};

export const BALANCING_CONSTRAINTS_FILL = "url(#balancing-constraints-hatch)";

export const BALANCING_IMPORTS_COLOR = "var(--chart-balancing-imports)";
export const BALANCING_EXPORTS_COLOR = "var(--chart-balancing-exports)";

export function emptyPence(): CategoryPence {
  return {
    energy_imbalance: 0,
    frequency_control: 0,
    positive_reserve: 0,
    negative_reserve: 0,
    constraints: 0,
    other: 0,
  };
}

/** Day total. The six categories are the whole sum. Trade value is not an input. */
export function sumCategoryPence(pence: CategoryPence): number {
  let total = 0;
  for (const category of BALANCING_CATEGORIES) {
    total += pence[category];
  }
  return total;
}
