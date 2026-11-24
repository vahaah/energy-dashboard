import {
  constraintsShare,
  dailyChartPoints,
  dayTotalPence,
  daysInFinancialYear,
  financialYearId,
  financialYearLabel,
  financialYearStart,
  missingSettlementDates,
  monthlyChartPoints,
  netTradePence,
  nextDraftTariff,
  rangeStart,
  sumCategoryRows,
  tradeMonthsInRange,
  sumCountries,
  tariffCovering,
  type DailyChartPoint,
  type MonthlyChartPoint,
} from "@/lib/balancing/aggregate";
import { sumCategoryPence } from "@/lib/balancing/categories";
import { householdPence } from "@/lib/balancing/household";
import { BALANCING_RANGES, type BalancingRange, type BalancingRelease, type TradeCountry, type TradeMonth } from "@/lib/balancing/types";
import { getLondonDate } from "@/lib/london-time";

export type BalancingPageModel = {
  available: boolean;
  today: string;
  latest: {
    date: string;
    pence: number;
    periods: number;
    expectedPeriods: number;
    provisional: boolean;
    yesterday: boolean;
  } | null;
  financialYear: string;
  financialYearLabel: string;
  fyFrom: string | null;
  fyPence: number | null;
  fyThrough: string | null;
  missingDates: string[];
  constraintsPence: number | null;
  constraintsShare: number | null;
  tariff: { gbpPerMwh: number; title: string; from: string; to: string } | null;
  draft: { gbpPerMwh: number; from: string; to: string } | null;
  householdPence: number | null;
  dailyFy2526Pence: number | null;
  generatedAt: string | null;
  calendarTrade: {
    year: number;
    from: string;
    to: string;
    importPence: number;
    exportPence: number;
    netPence: number;
  } | null;
  days: BalancingRelease["days"];
  tariffs: BalancingRelease["tariffs"];
  tradeByRange: Record<BalancingRange, TradeMonth[]>;
};

export function buildBalancingPage(release: BalancingRelease | null, now: Date): BalancingPageModel {
  const today = getLondonDate(now);
  const financialYear = financialYearId(today);
  const empty: BalancingPageModel = {
    available: false,
    today,
    latest: null,
    financialYear,
    financialYearLabel: financialYearLabel(financialYear),
    fyFrom: null,
    fyPence: null,
    fyThrough: null,
    missingDates: [],
    constraintsPence: null,
    constraintsShare: null,
    tariff: null,
    draft: null,
    householdPence: null,
    dailyFy2526Pence: null,
    generatedAt: null,
    calendarTrade: null,
    days: [],
    tariffs: [],
    tradeByRange: emptyTradeRanges(),
  };
  if (!release || release.days.length === 0) {
    return empty;
  }
  const days = release.days.filter((day) => day.date <= today);
  const latest = days[days.length - 1] ?? null;
  const fyDays = daysInFinancialYear(days, financialYear);
  const fyCategories = fyDays.length > 0 ? sumCategoryRows(fyDays) : null;
  const fyThrough = fyDays[fyDays.length - 1]?.date ?? null;
  const fyFrom = fyDays.length > 0 ? financialYearStart(financialYear) : null;
  const tariff = tariffCovering(release.tariffs, today);
  const draft = nextDraftTariff(release.tariffs, today);
  const fy2526 = daysInFinancialYear(days, "2025-2026");
  return {
    available: true,
    today,
    latest: latest
      ? {
          date: latest.date,
          pence: dayTotalPence(latest),
          periods: latest.periods,
          expectedPeriods: latest.expected_periods,
          provisional: latest.provisional,
          yesterday: latest.date === addDays(today, -1),
        }
      : null,
    financialYear,
    financialYearLabel: financialYearLabel(financialYear),
    fyFrom,
    fyPence: fyCategories ? sumCategoryPence(fyCategories) : null,
    fyThrough,
    missingDates: fyFrom && fyThrough ? missingSettlementDates(fyDays.map((day) => day.date), fyFrom, fyThrough) : [],
    constraintsPence: fyCategories?.constraints ?? null,
    constraintsShare: fyCategories ? constraintsShare(fyCategories) : null,
    tariff: tariff
      ? { gbpPerMwh: tariff.gbp_per_mwh, title: tariff.title, from: tariff.from, to: tariff.to }
      : null,
    draft: draft ? { gbpPerMwh: draft.gbp_per_mwh, from: draft.from, to: draft.to } : null,
    householdPence: tariff ? householdPence(tariff.gbp_per_mwh) : null,
    dailyFy2526Pence: fy2526.length > 0 ? sumCategoryPence(sumCategoryRows(fy2526)) : null,
    generatedAt: release.generated_at,
    calendarTrade: calendarYearTrade(release.trade_days, 2025),
    days,
    tariffs: release.tariffs,
    tradeByRange: tradeRanges(release.trade_days, today),
  };
}

function calendarYearTrade(days: BalancingRelease["trade_days"], year: number): BalancingPageModel["calendarTrade"] {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const months = tradeMonthsInRange(days, from, to);
  if (months.length === 0) {
    return null;
  }
  const net = tradeNet(months);
  return { year, from, to, importPence: net.importPence, exportPence: net.exportPence, netPence: net.netPence };
}

function emptyTradeRanges(): Record<BalancingRange, TradeMonth[]> {
  return { "90d": [], "1y": [], fy: [], all: [] };
}

function tradeRanges(days: BalancingRelease["trade_days"], today: string): Record<BalancingRange, TradeMonth[]> {
  const ranges = emptyTradeRanges();
  for (const range of BALANCING_RANGES) {
    ranges[range] = tradeMonthsInRange(days, rangeStart(range, today), today);
  }
  return ranges;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function chartWindow(
  range: BalancingRange,
  today: string,
  days: BalancingPageModel["days"],
): { from: string | null; to: string; dailyFrom: string | null } {
  const from = rangeStart(range, today);
  const first = days[0]?.date ?? today;
  const dailyFrom = range === "all" ? rangeStart("fy", today) : from;
  return {
    from: from != null && from < first ? first : from,
    to: today,
    dailyFrom: dailyFrom != null && dailyFrom < first ? first : dailyFrom,
  };
}

export function dailySeries(model: BalancingPageModel, range: BalancingRange): DailyChartPoint[] {
  const window = chartWindow(range, model.today, model.days);
  return dailyChartPoints(model.days, window.dailyFrom, window.to);
}

export function monthlySeries(model: BalancingPageModel, range: BalancingRange): MonthlyChartPoint[] {
  const window = chartWindow(range, model.today, model.days);
  return monthlyChartPoints(model.days, model.tariffs, window.from, window.to);
}

export function tradeInRange(model: BalancingPageModel, range: BalancingRange): TradeMonth[] {
  return model.tradeByRange[range];
}

export type BalancingRangeSeries = {
  daily: DailyChartPoint[];
  monthly: MonthlyChartPoint[];
  trade: TradeMonth[];
};

/** Chart series for one control. The page ships 90 days and one year, then asks for the rest. */
export function balancingRangeSeries(model: BalancingPageModel, range: BalancingRange): BalancingRangeSeries {
  return {
    daily: dailySeries(model, range),
    monthly: monthlySeries(model, range),
    trade: tradeInRange(model, range),
  };
}

export function tradeCountryTotals(months: readonly TradeMonth[]): TradeCountry[] {
  return sumCountries(months.flatMap((month) => month.countries));
}

export function tradeNet(months: readonly TradeMonth[]): { importPence: number; exportPence: number; netPence: number } {
  const rows = tradeCountryTotals(months);
  let importPence = 0;
  let exportPence = 0;
  for (const row of rows) {
    importPence += row.import_pence;
    exportPence += row.export_pence;
  }
  return { importPence, exportPence, netPence: netTradePence({ import_pence: importPence, export_pence: exportPence }) };
}
