import {
  COMMODITY_RANGES,
  DASHBOARD_RANGES,
  isValidDashboardDate,
} from "@/lib/dashboard-search-params";
import type { CommodityRange, TimeRange } from "@/lib/types";

export const INTERCONNECTOR_RANGES = ["24h", "7d"] as const;

export type InterconnectorRange = (typeof INTERCONNECTOR_RANGES)[number];

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function parseLiteral<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
  label: string
): ParseResult<T> {
  if (value == null || value === "") {
    return { ok: true, value: fallback };
  }

  if (allowed.includes(value as T)) {
    return { ok: true, value: value as T };
  }

  return {
    ok: false,
    error: `Invalid ${label} "${value}". Expected one of: ${allowed.join(", ")}.`,
  };
}

export function parseTimeRange(
  value: string | null,
  fallback: TimeRange = "24h"
): ParseResult<TimeRange> {
  return parseLiteral(value, DASHBOARD_RANGES, fallback, "range");
}

export function parseCommodityRange(
  value: string | null,
  fallback: CommodityRange = "30d"
): ParseResult<CommodityRange> {
  return parseLiteral(value, COMMODITY_RANGES, fallback, "range");
}

export function parseInterconnectorRange(
  value: string | null,
  fallback: InterconnectorRange = "24h"
): ParseResult<InterconnectorRange> {
  return parseLiteral(value, INTERCONNECTOR_RANGES, fallback, "range");
}

export function parseOptionalDate(value: string | null): ParseResult<string | null> {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }

  if (!isValidDashboardDate(value)) {
    return {
      ok: false,
      error: `Invalid date "${value}". Expected YYYY-MM-DD.`,
    };
  }

  return { ok: true, value };
}
