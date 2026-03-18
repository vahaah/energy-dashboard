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
    : formatDate(now);
}

function getCalendarDayQueryParams(
  selectedDate?: string | null,
  now = new Date()
): QueryParams {
  const day = getEffectiveDashboardDate(selectedDate, now);

  return {
    start: `${day} 00:00:00`,
    end: `${day} 23:59:59`,
  };
}

export function getSnapshotsQueryParams(
  range: TimeRange,
  now = new Date(),
  selectedDate?: string | null
): QueryParams {
  if (range === "24h") {
    return getCalendarDayQueryParams(selectedDate, now);
  }

  const params: QueryParams = {
    start: "",
    end: formatDateTime(now),
  };

  let start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  switch (range) {
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      params.granularity = "day";
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      params.granularity = "day";
      break;
    case "1y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      params.granularity = "day";
      break;
    default:
      break;
  }

  params.start = formatDateTime(start);
  return params;
}

export function getPricesQueryParams(
  range: CommodityRange,
  now = new Date()
): QueryParams {
  let start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  switch (range) {
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      break;
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
    return getCalendarDayQueryParams(selectedDate, now);
  }

  const params: QueryParams = {
    start: "",
    end: formatDateTime(now),
  };

  let start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  switch (range) {
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      params.granularity = "hour";
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      params.granularity = "hour";
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      params.granularity = "day";
      break;
    case "1y":
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      params.granularity = "day";
      break;
    default:
      break;
  }

  params.start = formatDateTime(start);
  return params;
}

export function getInterconnectorQueryParams(
  range: "24h" | "7d",
  now = new Date(),
  selectedDate?: string | null
): QueryParams {
  if (range === "24h") {
    return getCalendarDayQueryParams(selectedDate, now);
  }

  const start =
    range === "7d"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return {
    start: formatDateTime(start),
    end: formatDateTime(now),
  };
}
