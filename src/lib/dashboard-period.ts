import type { TimeRange, TinybirdTimeRange } from "@/lib/types";

export const DASHBOARD_PERIODS = ["day", "week", "year", "all"] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export function isDashboardPeriod(value: string | null | undefined): value is DashboardPeriod {
  return value === "day" || value === "week" || value === "year" || value === "all";
}

export function selectedPeriod(
  period: DashboardPeriod | null | undefined,
  range: TimeRange
): DashboardPeriod | null {
  if (period) {
    return period;
  }

  switch (range) {
    case "24h":
      return "day";
    case "7d":
      return "week";
    case "1y":
      return "year";
    case "all":
      return "all";
    case "30d":
    case "90d":
      return null;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function isNesoPeriod(period: DashboardPeriod | null): boolean {
  return period === "year" || period === "all";
}

export function chartRangeForPeriod(
  period: DashboardPeriod | null,
  range: TimeRange
): TimeRange {
  if (period === "day") {
    return "24h";
  }
  if (period === "week") {
    return "7d";
  }
  if (period === "year") {
    return "1y";
  }
  if (period === "all") {
    return "all";
  }
  return range;
}

export function isTinybirdTimeRange(range: TimeRange): range is TinybirdTimeRange {
  return range !== "all";
}

export function tinybirdRangeForPeriod(
  period: DashboardPeriod | null,
  range: TimeRange
): TinybirdTimeRange {
  if (period === "week") {
    return "7d";
  }
  if (period === "day") {
    return "24h";
  }
  const chartRange = chartRangeForPeriod(period, range);
  if (isTinybirdTimeRange(chartRange)) {
    return chartRange;
  }
  return "24h";
}

export function searchStateForPeriod(period: DashboardPeriod): {
  period: DashboardPeriod;
  range: TinybirdTimeRange;
  date: null;
} {
  switch (period) {
    case "day":
      return { period: "day", range: "24h", date: null };
    case "week":
      return { period: "week", range: "7d", date: null };
    case "year":
      return { period: "year", range: "1y", date: null };
    case "all":
      return { period: "all", range: "1y", date: null };
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}
