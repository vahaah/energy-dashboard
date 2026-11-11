import { constraintsShare, dayTotalPence, daysInFinancialYear, financialYearId, financialYearLabel, mergeCostDays, mergeTradeDays, sumCategoryRows, tariffCovering, tradeMonthsFromDays } from "@/lib/balancing/aggregate";
import { emptyPence, sumCategoryPence } from "@/lib/balancing/categories";
import { householdPence } from "@/lib/balancing/household";
import type { BalancingDay, BalancingRelease, BalancingTariff, HomeCardFile, TradeDay } from "@/lib/balancing/types";
import { getLondonDate } from "@/lib/london-time";

function dedupeDays(days: readonly BalancingDay[]): BalancingDay[] {
  const byDate = new Map<string, BalancingDay>();
  for (const day of days) {
    byDate.set(day.date, day);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function dedupeTrade(days: readonly TradeDay[]): TradeDay[] {
  const byDate = new Map<string, TradeDay>();
  for (const day of days) {
    byDate.set(day.date, day);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function buildRelease(input: {
  now: Date;
  days: readonly BalancingDay[];
  tariffs: readonly BalancingTariff[];
  tradeDays: readonly TradeDay[];
  costsIssuedAt: string | null;
  tariffsIssuedAt: string | null;
  tradeRetrievedAt: string | null;
}): BalancingRelease {
  const today = getLondonDate(input.now);
  const days = dedupeDays(input.days).filter((day) => day.date <= today);
  const tradeDays = dedupeTrade(input.tradeDays).filter((day) => day.date <= today);
  return {
    schema_version: 1,
    generated_at: input.now.toISOString(),
    costs_issued_at: input.costsIssuedAt,
    tariffs_issued_at: input.tariffsIssuedAt,
    trade_retrieved_at: input.tradeRetrievedAt,
    days,
    tariffs: [...input.tariffs].sort((left, right) => left.from.localeCompare(right.from)),
    trade_months: tradeMonthsFromDays(tradeDays, today),
    trade_days: tradeDays,
  };
}

export function applyWindow(
  base: BalancingRelease,
  window: {
    from: string;
    to: string;
    tradeFrom: string;
    days: readonly BalancingDay[];
    tariffs: readonly BalancingTariff[];
    tradeDays: readonly TradeDay[];
    costsIssuedAt: string | null;
    tariffsIssuedAt: string | null;
  },
  now: Date,
): BalancingRelease {
  const today = getLondonDate(now);
  const days = mergeCostDays(base.days, window.from, window.to, window.days).filter((day) => day.date <= today);
  const tradeDays = mergeTradeDays(base.trade_days, window.tradeFrom, window.to, window.tradeDays).filter(
    (day) => day.date <= today,
  );
  return buildRelease({
    now,
    days,
    tariffs: window.tariffs.length > 0 ? window.tariffs : base.tariffs,
    tradeDays,
    costsIssuedAt: window.costsIssuedAt ?? base.costs_issued_at,
    tariffsIssuedAt: window.tariffsIssuedAt ?? base.tariffs_issued_at,
    tradeRetrievedAt: now.toISOString(),
  });
}

export function emptyRelease(now: Date): BalancingRelease {
  return buildRelease({
    now,
    days: [],
    tariffs: [],
    tradeDays: [],
    costsIssuedAt: null,
    tariffsIssuedAt: null,
    tradeRetrievedAt: null,
  });
}

export function buildHomeCard(release: BalancingRelease, today: string): HomeCardFile {
  const days = release.days.filter((day) => day.date <= today);
  const latest = days[days.length - 1] ?? null;
  const financialYear = financialYearId(today);
  const fyDays = daysInFinancialYear(days, financialYear);
  const fyPence = fyDays.length > 0 ? sumCategoryRows(fyDays) : emptyPence();
  const tariff = tariffCovering(release.tariffs, today);
  return {
    schema_version: 1,
    latest_date: latest?.date ?? null,
    latest_pence: latest ? dayTotalPence(latest) : null,
    latest_provisional: latest?.provisional ?? false,
    financial_year: fyDays.length > 0 ? financialYear : null,
    fy_pence: fyDays.length > 0 ? sumCategoryPence(fyPence) : null,
    fy_through: fyDays[fyDays.length - 1]?.date ?? null,
    constraints_share: fyDays.length > 0 ? constraintsShare(fyPence) : null,
    tariff_gbp_per_mwh: tariff?.gbp_per_mwh ?? null,
    tariff_label: tariff ? `${tariff.publication} ${tariff.title}, ${tariff.from} to ${tariff.to}` : null,
    household_pence: tariff ? householdPence(tariff.gbp_per_mwh) : null,
    generated_at: release.generated_at,
  };
}

export function financialYearTotals(release: BalancingRelease): Array<{
  financial_year: string;
  label: string;
  days: number;
  pence: number;
  constraints_pence: number;
}> {
  const years = new Map<string, BalancingDay[]>();
  for (const day of release.days) {
    const id = financialYearId(day.date);
    const list = years.get(id) ?? [];
    list.push(day);
    years.set(id, list);
  }
  return [...years.keys()].sort().map((id) => {
    const rows = years.get(id) ?? [];
    const pence = sumCategoryRows(rows);
    return {
      financial_year: id,
      label: financialYearLabel(id),
      days: rows.length,
      pence: sumCategoryPence(pence),
      constraints_pence: pence.constraints,
    };
  });
}
