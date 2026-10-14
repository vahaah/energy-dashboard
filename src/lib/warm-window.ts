import { isValidDashboardDate } from "@/lib/dashboard-search-params";
import { addUtcDays, getLondonDate, londonMidnightUtc, parseUtcDateTime } from "@/lib/london-time";
import type { TinybirdTimeRange } from "@/lib/types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const RANGE_MS: Record<TinybirdTimeRange, number> = {
  "24h": 24 * HOUR_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "90d": 90 * DAY_MS,
  "1y": 365 * DAY_MS,
};

export function londonDayInsideWarmWindow(
  date: string,
  range: TinybirdTimeRange,
  now: Date
): boolean {
  if (!isValidDashboardDate(date)) {
    return false;
  }
  const span = rangeSpanMs(range);
  const dayStart = londonMidnightUtc(date).getTime();
  if (Number.isNaN(dayStart)) {
    return false;
  }
  const windowStart = now.getTime() - span;
  return dayStart >= windowStart && dayStart <= now.getTime();
}

/**
 * `null` when the request should be served from the rolling envelope.
 * `"range_not_warmed"` when `?date=` would have been a fresh pipe call.
 */
export function unwarmedDateError(
  date: string | null,
  range: TinybirdTimeRange,
  now: Date
): "range_not_warmed" | null {
  if (!date || date === getLondonDate(now)) {
    return null;
  }
  return londonDayInsideWarmWindow(date, range, now) ? null : "range_not_warmed";
}

export function sliceLondonDay<T extends { timestamp: string }>(
  rows: T[],
  date: string | null,
  now: Date
): T[] {
  if (!date || date === getLondonDate(now)) {
    return rows;
  }
  if (!isValidDashboardDate(date)) {
    return [];
  }

  const start = londonMidnightUtc(date).getTime();
  const end = londonMidnightUtc(addUtcDays(date, 1)).getTime();
  return rows.filter((row) => {
    const ms = parseUtcDateTime(row.timestamp).getTime();
    return ms >= start && ms < end;
  });
}

function rangeSpanMs(range: TinybirdTimeRange): number {
  switch (range) {
    case "24h":
    case "7d":
    case "30d":
    case "90d":
    case "1y":
      return RANGE_MS[range];
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}
