import {
  createParser,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import { getLondonDate } from "@/lib/london-time";

export const DASHBOARD_RANGES = ["24h", "7d", "30d", "90d", "1y"] as const;
export const COMMODITY_RANGES = ["30d", "90d", "1y"] as const;
export const DASHBOARD_FOCUSES = [
  "overview",
  "generation",
  "price",
  "transfers",
  "commodities",
  "carbon",
] as const;

export const DASHBOARD_COVERAGE_DAYS = 365;

export type DashboardDateStatus = "latest" | "historical" | "empty";

export type DashboardDateResolution = {
  status: DashboardDateStatus;
  date: string;
  today: string;
  coverageStart: string;
};

export function isValidDashboardDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getDashboardCoverageStart(now = new Date()): string {
  return getLondonDate(new Date(now.getTime() - DASHBOARD_COVERAGE_DAYS * 24 * 60 * 60 * 1000));
}

export function clampDashboardDate(value: string, now = new Date()): string {
  const today = getLondonDate(now);
  const coverageStart = getDashboardCoverageStart(now);
  if (value < coverageStart) {
    return coverageStart;
  }
  if (value > today) {
    return today;
  }
  return value;
}

export function dateParamForRange(
  range: (typeof DASHBOARD_RANGES)[number],
  date: string | null | undefined
): string | null {
  if (range !== "24h") {
    return null;
  }
  return date && isValidDashboardDate(date) ? date : null;
}

export function resolveDashboardDate(
  selectedDate: string | null | undefined,
  now = new Date(),
  range: (typeof DASHBOARD_RANGES)[number] = "24h"
): DashboardDateResolution {
  const today = getLondonDate(now);
  const coverageStart = getDashboardCoverageStart(now);
  const date = dateParamForRange(range, selectedDate);

  if (!date || date === today) {
    return { status: "latest", date: today, today, coverageStart };
  }

  if (date < coverageStart || date > today) {
    return { status: "empty", date, today, coverageStart };
  }

  return { status: "historical", date, today, coverageStart };
}

const parseAsDashboardDate = createParser<string>({
  parse: (value) => (isValidDashboardDate(value) ? value : null),
  serialize: (value) => value,
});

export const dashboardSearchParamParsers = {
  range: parseAsStringLiteral(DASHBOARD_RANGES).withDefault("24h"),
  commodityRange: parseAsStringLiteral(COMMODITY_RANGES).withDefault("90d"),
  focus: parseAsStringLiteral(DASHBOARD_FOCUSES).withDefault("overview"),
  date: parseAsDashboardDate,
};

export type DashboardSearchParams = inferParserType<
  typeof dashboardSearchParamParsers
>;
