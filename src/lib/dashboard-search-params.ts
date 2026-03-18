import {
  createParser,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

export const DASHBOARD_RANGES = ["24h", "7d", "30d", "90d", "1y"] as const;
export const COMMODITY_RANGES = ["30d", "90d", "1y"] as const;
export const DASHBOARD_FOCUSES = [
  "overview",
  "carbon",
  "price",
  "generation",
  "transfers",
  "commodities",
] as const;

export function isValidDashboardDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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
