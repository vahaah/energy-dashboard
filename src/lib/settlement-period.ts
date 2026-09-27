import {
  addUtcDays,
  formatTinybirdDateTime,
  getLondonDate,
  londonMidnightUtc,
} from "@/lib/london-time";

export interface SettlementPeriod {
  settlementDate: string;
  settlementPeriod: number;
  startUtc: Date;
  endUtc: Date;
}

export function periodsInSettlementDay(settlementDate: string): number {
  const start = londonMidnightUtc(settlementDate);
  const end = londonMidnightUtc(addUtcDays(settlementDate, 1));
  return Math.round((end.getTime() - start.getTime()) / (30 * 60 * 1000));
}

export function settlementPeriodToUtc(
  settlementDate: string,
  settlementPeriod: number
): Date {
  const midnight = londonMidnightUtc(settlementDate);
  return new Date(midnight.getTime() + (settlementPeriod - 1) * 30 * 60 * 1000);
}

export function getSettlementPeriod(at: Date): SettlementPeriod {
  const settlementDate = getLondonDate(at);
  const midnight = londonMidnightUtc(settlementDate);
  const nextMidnight = londonMidnightUtc(addUtcDays(settlementDate, 1));

  if (at.getTime() >= nextMidnight.getTime()) {
    return getSettlementPeriod(nextMidnight);
  }

  if (at.getTime() < midnight.getTime()) {
    return getSettlementPeriod(new Date(midnight.getTime() - 1));
  }

  const settlementPeriod =
    Math.floor((at.getTime() - midnight.getTime()) / (30 * 60 * 1000)) + 1;
  const startUtc = settlementPeriodToUtc(settlementDate, settlementPeriod);

  return {
    settlementDate,
    settlementPeriod,
    startUtc,
    endUtc: new Date(startUtc.getTime() + 30 * 60 * 1000),
  };
}

export function listSettlementPeriods(settlementDate: string): SettlementPeriod[] {
  const count = periodsInSettlementDay(settlementDate);
  const periods: SettlementPeriod[] = [];

  for (let settlementPeriod = 1; settlementPeriod <= count; settlementPeriod += 1) {
    const startUtc = settlementPeriodToUtc(settlementDate, settlementPeriod);
    periods.push({
      settlementDate,
      settlementPeriod,
      startUtc,
      endUtc: new Date(startUtc.getTime() + 30 * 60 * 1000),
    });
  }

  return periods;
}

export function listRecentSettlementPeriods(
  at: Date,
  lookbackMs: number
): SettlementPeriod[] {
  const start = new Date(at.getTime() - lookbackMs);
  const dates = new Set<string>([getLondonDate(start), getLondonDate(at)]);
  const periods: SettlementPeriod[] = [];

  for (const settlementDate of dates) {
    for (const period of listSettlementPeriods(settlementDate)) {
      if (period.endUtc.getTime() > start.getTime() && period.endUtc.getTime() <= at.getTime()) {
        periods.push(period);
      }
    }
  }

  return periods.sort((left, right) => left.startUtc.getTime() - right.startUtc.getTime());
}

export function settlementTimestamp(period: SettlementPeriod): string {
  return formatTinybirdDateTime(period.startUtc);
}
