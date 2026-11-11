import { sumCategoryPence, type CategoryPence } from "@/lib/balancing/categories";
import { compareCountries } from "@/lib/balancing/countries";
import type { BalancingDay, BalancingRange, BalancingTariff, TradeCountry, TradeDay, TradeMonth } from "@/lib/balancing/types";
import { addUtcDays } from "@/lib/london-time";
import { periodsInSettlementDay } from "@/lib/settlement-period";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/** NESO financial year, April to March. `2025-11-09` is `2025-2026`. */
export function financialYearId(isoDate: string): string {
  if (!isIsoDate(isoDate)) {
    throw new Error(`not a settlement date: ${isoDate}`);
  }
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const start = month >= 4 ? year : year - 1;
  return `${start}-${start + 1}`;
}

export function financialYearLabel(id: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(id);
  if (!match?.[1] || !match[2]) {
    return id;
  }
  return `${match[1]}/${match[2].slice(2)}`;
}

export function financialYearStart(id: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(id);
  if (!match?.[1]) {
    throw new Error(`not a financial year: ${id}`);
  }
  return `${match[1]}-04-01`;
}

/** Resource title on the NESO package. It changes each April. */
export function balancingResourceName(financialYear: string): string {
  return `Daily Balancing Costs ${financialYear}`;
}

export function financialYearsThrough(firstStartYear: number, today: string): string[] {
  const end = Number(financialYearId(today).slice(0, 4));
  const years: string[] = [];
  for (let year = firstStartYear; year <= end; year += 1) {
    years.push(`${year}-${year + 1}`);
  }
  return years;
}

export function isProvisionalDay(periods: number, expected: number): boolean {
  return periods < expected;
}

export function costDay(date: string, periods: number, pence: CategoryPence): BalancingDay {
  if (!isIsoDate(date)) {
    throw new Error(`not a settlement date: ${date}`);
  }
  const expected = periodsInSettlementDay(date);
  return {
    date,
    periods,
    expected_periods: expected,
    provisional: isProvisionalDay(periods, expected),
    pence,
  };
}

export function dayTotalPence(day: BalancingDay): number {
  return sumCategoryPence(day.pence);
}

export function sumDaysPence(days: readonly BalancingDay[]): number {
  let total = 0;
  for (const day of days) {
    total += dayTotalPence(day);
  }
  return total;
}

export function daysInFinancialYear(days: readonly BalancingDay[], financialYear: string): BalancingDay[] {
  return days.filter((day) => financialYearId(day.date) === financialYear);
}

/**
 * Replace dates inside the inclusive window with the fetched rows.
 * A date in the window that the fetch did not return is removed. It is not written as zero.
 */
export function mergeCostDays(
  existing: readonly BalancingDay[],
  from: string,
  to: string,
  fetched: readonly BalancingDay[],
): BalancingDay[] {
  const kept = existing.filter((day) => day.date < from || day.date > to);
  const incoming = fetched.filter((day) => day.date >= from && day.date <= to);
  return [...kept, ...incoming].sort((left, right) => left.date.localeCompare(right.date));
}

export function netTradePence(row: { import_pence: number; export_pence: number }): number {
  return row.import_pence - row.export_pence;
}

export function sumCountries(rows: readonly TradeCountry[]): TradeCountry[] {
  const totals = new Map<string, TradeCountry>();
  for (const row of rows) {
    const current = totals.get(row.country) ?? {
      country: row.country,
      import_pence: 0,
      export_pence: 0,
      import_mwh: 0,
      export_mwh: 0,
    };
    current.import_pence += row.import_pence;
    current.export_pence += row.export_pence;
    current.import_mwh += row.import_mwh;
    current.export_mwh += row.export_mwh;
    totals.set(row.country, current);
  }
  return [...totals.values()].sort((left, right) => compareCountries(left.country, right.country));
}

function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Roll daily country rows up to months. A missing day stays missing. The month is provisional when coverage is short. */
export function tradeMonthsFromDays(days: readonly TradeDay[], today: string): TradeMonth[] {
  const byMonth = new Map<string, TradeDay[]>();
  for (const day of days) {
    const month = monthOf(day.date);
    const list = byMonth.get(month) ?? [];
    list.push(day);
    byMonth.set(month, list);
  }
  const months = [...byMonth.keys()].sort();
  return months.map((month) => {
    const rows = byMonth.get(month) ?? [];
    const inMonth = daysInMonth(month);
    const todayMonth = monthOf(today);
    const expected = month < todayMonth ? inMonth : month === todayMonth ? Number(today.slice(8, 10)) : rows.length;
    const provisional = rows.some((row) => row.provisional) || rows.length < expected;
    return {
      month,
      provisional,
      countries: sumCountries(rows.flatMap((row) => row.countries)),
    };
  });
}

export function mergeTradeDays(
  existing: readonly TradeDay[],
  from: string,
  to: string,
  fetched: readonly TradeDay[],
): TradeDay[] {
  const kept = existing.filter((day) => day.date < from || day.date > to);
  const incoming = fetched.filter((day) => day.date >= from && day.date <= to);
  return [...kept, ...incoming].sort((left, right) => left.date.localeCompare(right.date));
}

export function constraintsShare(pence: CategoryPence): number | null {
  const total = sumCategoryPence(pence);
  if (total <= 0) {
    return null;
  }
  return pence.constraints / total;
}

export function addPence(left: CategoryPence, right: CategoryPence): CategoryPence {
  return {
    energy_imbalance: left.energy_imbalance + right.energy_imbalance,
    frequency_control: left.frequency_control + right.frequency_control,
    positive_reserve: left.positive_reserve + right.positive_reserve,
    negative_reserve: left.negative_reserve + right.negative_reserve,
    constraints: left.constraints + right.constraints,
    other: left.other + right.other,
  };
}

export function sumCategoryRows(days: readonly BalancingDay[]): CategoryPence {
  return days.reduce((total, day) => addPence(total, day.pence), {
    energy_imbalance: 0,
    frequency_control: 0,
    positive_reserve: 0,
    negative_reserve: 0,
    constraints: 0,
    other: 0,
  });
}

export function tariffCovering(tariffs: readonly BalancingTariff[], date: string): BalancingTariff | null {
  const matches = tariffs.filter(
    (tariff) => tariff.publication === "Final" && tariff.from <= date && date <= tariff.to,
  );
  matches.sort((left, right) => right.published.localeCompare(left.published) || right.from.localeCompare(left.from));
  return matches[0] ?? null;
}

export function nextDraftTariff(tariffs: readonly BalancingTariff[], today: string): BalancingTariff | null {
  const drafts = tariffs
    .filter((tariff) => tariff.publication === "Draft" && tariff.from > today)
    .sort((left, right) => left.from.localeCompare(right.from));
  return drafts[0] ?? null;
}

export function rangeStart(range: BalancingRange, today: string): string | null {
  switch (range) {
    case "90d":
      return addUtcDays(today, -89);
    case "1y":
      return addUtcDays(today, -364);
    case "fy":
      return financialYearStart(financialYearId(today));
    case "all":
      return null;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export type DailyChartPoint = {
  date: string;
  provisional: boolean;
  gap: boolean;
  energy_imbalance: number | null;
  frequency_control: number | null;
  positive_reserve: number | null;
  negative_reserve: number | null;
  constraints: number | null;
  other: number | null;
  total: number | null;
};

function gapPoint(date: string): DailyChartPoint {
  return {
    date,
    provisional: false,
    gap: true,
    energy_imbalance: null,
    frequency_control: null,
    positive_reserve: null,
    negative_reserve: null,
    constraints: null,
    other: null,
    total: null,
  };
}

/** One point per settlement date. A day NESO did not publish is null, not zero. */
export function dailyChartPoints(days: readonly BalancingDay[], from: string | null, to: string): DailyChartPoint[] {
  if (days.length === 0) {
    return [];
  }
  const first = days[0]?.date ?? to;
  const last = days[days.length - 1]?.date ?? to;
  const start = from == null ? first : from < first ? first : from;
  const end = to < last ? to : last;
  if (start > end) {
    return [];
  }
  const byDate = new Map(days.map((day) => [day.date, day]));
  const points: DailyChartPoint[] = [];
  for (let date = start; date <= end; date = addUtcDays(date, 1)) {
    const day = byDate.get(date);
    if (!day) {
      points.push(gapPoint(date));
      continue;
    }
    points.push({
      date,
      provisional: day.provisional,
      gap: false,
      energy_imbalance: day.pence.energy_imbalance,
      frequency_control: day.pence.frequency_control,
      positive_reserve: day.pence.positive_reserve,
      negative_reserve: day.pence.negative_reserve,
      constraints: day.pence.constraints,
      other: day.pence.other,
      total: dayTotalPence(day),
    });
  }
  return points;
}

export type MonthlyChartPoint = {
  month: string;
  provisional: boolean;
  gap: boolean;
  constraints: number | null;
  other: number | null;
  total: number | null;
  tariff_gbp_per_mwh: number | null;
};

export function monthlyChartPoints(
  days: readonly BalancingDay[],
  tariffs: readonly BalancingTariff[],
  from: string | null,
  to: string,
): MonthlyChartPoint[] {
  const filtered = days.filter((day) => (from == null || day.date >= from) && day.date <= to);
  if (filtered.length === 0) {
    return [];
  }
  const byMonth = new Map<string, BalancingDay[]>();
  for (const day of filtered) {
    const month = monthOf(day.date);
    const list = byMonth.get(month) ?? [];
    list.push(day);
    byMonth.set(month, list);
  }
  const start = monthOf(filtered[0]?.date ?? to);
  const end = monthOf(filtered[filtered.length - 1]?.date ?? to);
  const points: MonthlyChartPoint[] = [];
  let cursor = `${start}-01`;
  const endCursor = `${end}-01`;
  while (cursor <= endCursor) {
    const month = monthOf(cursor);
    const rows = byMonth.get(month) ?? [];
    const tariff = tariffCovering(tariffs, cursor);
    if (rows.length === 0) {
      points.push({
        month,
        provisional: false,
        gap: true,
        constraints: null,
        other: null,
        total: null,
        tariff_gbp_per_mwh: tariff?.gbp_per_mwh ?? null,
      });
    } else {
      const pence = sumCategoryRows(rows);
      const inMonth = daysInMonth(month);
      const monthEnd = month === monthOf(to) ? Number(to.slice(8, 10)) : inMonth;
      const provisional = rows.some((row) => row.provisional) || rows.length < monthEnd;
      const total = sumCategoryPence(pence);
      points.push({
        month,
        provisional,
        gap: false,
        constraints: pence.constraints,
        other: total - pence.constraints,
        total,
        tariff_gbp_per_mwh: tariff?.gbp_per_mwh ?? null,
      });
    }
    const year = Number(month.slice(0, 4));
    const monthNumber = Number(month.slice(5, 7));
    const next = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
    cursor = next;
  }
  return points;
}
