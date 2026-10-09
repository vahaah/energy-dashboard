import {
  getLondonDateTimeParts,
  getLondonOffsetLabel,
  parseUtcDateTime,
} from "@/lib/london-time";
import type { CommodityRange, TimeRange } from "@/lib/types";

type ChartRange = TimeRange | CommodityRange;

const WEEKDAY_INITIAL = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function asDate(value: string | number): Date | null {
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = parseUtcDateTime(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatChartTick(value: string | number, range: ChartRange): string {
  const date = asDate(value);
  if (!date) {
    return String(value);
  }

  const parts = getLondonDateTimeParts(date);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");

  switch (range) {
    case "24h":
      return `${hour}:${minute}`;
    case "7d":
      return WEEKDAY_INITIAL[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
    case "30d":
    case "90d":
      return `${parts.day} ${MONTHS[parts.month - 1]}`;
    case "1y":
      return MONTHS[parts.month - 1] ?? "";
    case "all":
      return String(parts.year);
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function formatChartTooltip(value: string | number, range: ChartRange): string {
  const date = asDate(value);
  if (!date) {
    return String(value);
  }

  const parts = getLondonDateTimeParts(date);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  const zone = getLondonOffsetLabel(date);
  const month = MONTHS[parts.month - 1];

  switch (range) {
    case "24h":
    case "7d":
      return `${parts.day} ${month} ${hour}:${minute} ${zone}`;
    case "30d":
    case "90d":
    case "1y":
      return `${String(parts.day).padStart(2, "0")} ${month} ${parts.year}`;
    case "all":
      return `${month} ${parts.year}`;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}
