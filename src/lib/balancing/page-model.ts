import {
  constraintsShare,
  dailyChartPoints,
  dayTotalPence,
  daysInFinancialYear,
  financialYearId,
  financialYearLabel,
  monthlyChartPoints,
  netTradePence,
  nextDraftTariff,
  rangeStart,
  sumCategoryRows,
  sumCountries,
  tariffCovering,
  type DailyChartPoint,
  type MonthlyChartPoint,
} from "@/lib/balancing/aggregate";
import { sumCategoryPence } from "@/lib/balancing/categories";
import { householdPence } from "@/lib/balancing/household";
import type { BalancingRange, BalancingRelease, TradeCountry, TradeMonth } from "@/lib/balancing/types";
import { getLondonDate } from "@/lib/london-time";

export type BalancingPageModel = {
  available: boolean;
  today: string;
  latest: {
    date: string;
    pence: number;
    provisional: boolean;
    yesterday: boolean;
  } | null;
  financialYear: string;
  financialYearLabel: string;
  fyPence: number | null;
  fyThrough: string | null;
  constraintsShare: number | null;
  tariff: { gbpPerMwh: number; label: string } | null;
  draft: { gbpPerMwh: number; from: string; to: string } | null;
  householdPence: number | null;
  dailyFy2526Pence: number | null;
  days: BalancingRelease["days"];
  tariffs: BalancingRelease["tariffs"];
  tradeMonths: TradeMonth[];
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
    fyPence: null,
    fyThrough: null,
    constraintsShare: null,
    tariff: null,
    draft: null,
    householdPence: null,
    dailyFy2526Pence: null,
    days: [],
    tariffs: [],
    tradeMonths: [],
  };
  if (!release || release.days.length === 0) {
    return empty;
  }
  const days = release.days.filter((day) => day.date <= today);
  const latest = days[days.length - 1] ?? null;
  const fyDays = daysInFinancialYear(days, financialYear);
  const fyPence = fyDays.length > 0 ? sumCategoryRows(fyDays) : null;
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
          provisional: latest.provisional,
          yesterday: latest.date === addDays(today, -1),
        }
      : null,
    financialYear,
    financialYearLabel: financialYearLabel(financialYear),
    fyPence: fyPence ? sumCategoryPence(fyPence) : null,
    fyThrough: fyDays[fyDays.length - 1]?.date ?? null,
    constraintsShare: fyPence ? constraintsShare(fyPence) : null,
    tariff: tariff
      ? { gbpPerMwh: tariff.gbp_per_mwh, label: `${tariff.title}, ${tariff.from} to ${tariff.to}` }
      : null,
    draft: draft ? { gbpPerMwh: draft.gbp_per_mwh, from: draft.from, to: draft.to } : null,
    householdPence: tariff ? householdPence(tariff.gbp_per_mwh) : null,
    dailyFy2526Pence: fy2526.length > 0 ? sumCategoryPence(sumCategoryRows(fy2526)) : null,
    days,
    tariffs: release.tariffs,
    tradeMonths: release.trade_months,
  };
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
  const window = chartWindow(range, model.today, model.days);
  return model.tradeMonths.filter((month) => {
    const start = `${month.month}-01`;
    if (window.from && `${month.month}-31` < window.from) {
      return false;
    }
    return start <= window.to;
  });
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
