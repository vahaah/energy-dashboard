import { addUtcDays, getLondonDate } from "@/lib/london-time";

function assertDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label} "${value}". Expected YYYY-MM-DD.`);
  }
  return value;
}

export function listSettlementDatesInclusive(fromDate: string, toDate: string): string[] {
  const from = assertDate(fromDate, "from");
  const to = assertDate(toDate, "to");
  if (from > to) {
    return [];
  }

  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return dates;
}

export function backfillSettlementDates(options: {
  from?: string;
  to?: string;
  days?: number;
  now?: Date;
}): string[] {
  const now = options.now ?? new Date();

  if (options.from && options.to) {
    return listSettlementDatesInclusive(options.from, options.to);
  }

  if (options.from) {
    return listSettlementDatesInclusive(options.from, getLondonDate(now));
  }

  const dayCount = options.days ?? 30;
  if (!Number.isFinite(dayCount) || dayCount < 1) {
    throw new Error(`Invalid days "${options.days}". Expected a positive number.`);
  }

  const end = options.to ?? getLondonDate(now);
  const start = addUtcDays(end, -(dayCount - 1));
  return listSettlementDatesInclusive(start, end);
}
