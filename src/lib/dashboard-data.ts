import { getLondonDate, londonMidnightUtc, addUtcDays } from "@/lib/london-time";
import type { CommodityRange, TimeRange } from "@/lib/types";
import { isValidDashboardDate } from "@/lib/dashboard-search-params";

type QueryParams = Record<string, string>;

function formatDateTime(value: Date): string {
  return value.toISOString().replace("T", " ").slice(0, 19);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function getEffectiveDashboardDate(
  selectedDate?: string | null,
  now = new Date()
): string {
  return selectedDate && isValidDashboardDate(selectedDate)
    ? selectedDate
    : getLondonDate(now);
}

function getCalendarDayQueryParams(selectedDate: string): QueryParams {
  const start = londonMidnightUtc(selectedDate);
  const end = new Date(londonMidnightUtc(addUtcDays(selectedDate, 1)).getTime() - 1000);

  return {
    start: formatDateTime(start),
    end: formatDateTime(end),
  };
}

function get24hQueryParams(
  now: Date,
  selectedDate?: string | null
): QueryParams {
  const today = getLondonDate(now);
  if (selectedDate && isValidDashboardDate(selectedDate) && selectedDate !== today) {
    return getCalendarDayQueryParams(selectedDate);
  }

  return {
    start: formatDateTime(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    end: formatDateTime(now),
  };
}

export function getSnapshotsQueryParams(
  range: TimeRange,
  now = new Date(),
  selectedDate?: string | null
): QueryParams {
  if (range === "24h") {
    return get24hQueryParams(now, selectedDate);
  }

  const end = formatDateTime(now);

  switch (range) {
    case "7d":
      return {
        start: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
        end,
      };
    case "30d":
      return {
        start: formatDateTime(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
        end,
        granularity: "day",
      };
    case "90d":
      return {
        start: formatDateTime(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
        end,
        granularity: "day",
      };
    case "1y":
      return {
        start: formatDateTime(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)),
        end,
        granularity: "day",
      };
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function getPricesQueryParams(
  range: CommodityRange,
  now = new Date()
): QueryParams {
  let start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  switch (range) {
    case "30d":
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }

  return {
    start: formatDate(start),
    end: formatDate(now),
  };
}

export function getGenerationQueryParams(
  range: TimeRange,
  now = new Date(),
  selectedDate?: string | null
): QueryParams {
  if (range === "24h") {
    return get24hQueryParams(now, selectedDate);
  }

  const end = formatDateTime(now);

  switch (range) {
    case "7d":
      return {
        start: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
        end,
        granularity: "hour",
      };
    case "30d":
      return {
        start: formatDateTime(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
        end,
        granularity: "hour",
      };
    case "90d":
      return {
        start: formatDateTime(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
        end,
        granularity: "day",
      };
    case "1y":
      return {
        start: formatDateTime(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)),
        end,
        granularity: "day",
      };
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function getInterconnectorQueryParams(
  range: "24h" | "7d",
  now = new Date(),
  selectedDate?: string | null
): QueryParams {
  if (range === "24h") {
    return get24hQueryParams(now, selectedDate);
  }

  return {
    start: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    end: formatDateTime(now),
  };
}
