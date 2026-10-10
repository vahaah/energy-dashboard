import type { DashboardPeriod } from "@/lib/dashboard-period";

export const DASHBOARD_BLOCKS = ["generation", "price", "transfers", "mix", "carbon"] as const;

export type DashboardBlock = (typeof DASHBOARD_BLOCKS)[number];

export const BLOCK_PERIOD_PARAMS = {
  generation: "generationPeriod",
  price: "pricePeriod",
  transfers: "transfersPeriod",
  mix: "mixPeriod",
  carbon: "carbonPeriod",
} as const;

export type BlockPeriodParam = (typeof BLOCK_PERIOD_PARAMS)[DashboardBlock];

export const PERIOD_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
] as const;

export function blockPeriodParam(block: DashboardBlock): BlockPeriodParam {
  switch (block) {
    case "generation":
      return BLOCK_PERIOD_PARAMS.generation;
    case "price":
      return BLOCK_PERIOD_PARAMS.price;
    case "transfers":
      return BLOCK_PERIOD_PARAMS.transfers;
    case "mix":
      return BLOCK_PERIOD_PARAMS.mix;
    case "carbon":
      return BLOCK_PERIOD_PARAMS.carbon;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

export function effectiveBlockPeriod(
  globalPeriod: DashboardPeriod,
  override: DashboardPeriod | null | undefined
): DashboardPeriod {
  return override ?? globalPeriod;
}

export function dashboardQueryKey(period: DashboardPeriod, date: string | null): string {
  return `dashboard:${period}:${date ?? ""}`;
}

export function pricesQueryKey(range: string): string {
  return `prices:${range}`;
}
