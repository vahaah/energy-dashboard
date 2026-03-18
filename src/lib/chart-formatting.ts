import { format } from "date-fns";
import type { CommodityRange, TimeRange } from "@/lib/types";

type ChartRange = TimeRange | CommodityRange;

export function formatChartTick(value: string | number, range: ChartRange): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  switch (range) {
    case "24h":
      return format(date, "HH:mm");
    case "7d":
      return format(date, "dd MMM");
    default:
      return format(date, "dd MMM");
  }
}

export function formatChartTooltip(value: string | number, range: ChartRange): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  switch (range) {
    case "24h":
      return format(date, "dd MMM HH:mm");
    case "7d":
      return format(date, "EEE dd MMM HH:mm");
    default:
      return format(date, "dd MMM yyyy");
  }
}
