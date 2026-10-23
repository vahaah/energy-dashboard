import { createHash } from "node:crypto";
import { CONSTRAINT_BOUNDARIES, DAY_AHEAD_HEADER, DAY_AHEAD_RETAINED_DATES, isConstraintBoundary } from "@/lib/constraints/boundaries";
import {
  BREAKDOWN_CATEGORIES,
  BREAKDOWN_HEADER,
  breakdownCostIndex,
  breakdownVolumeIndex,
  type BreakdownCategory,
} from "@/lib/constraints/categories";
import { csvRows, parsePublishedNumber } from "@/lib/constraints/csv";
import { londonDateTimeToUtc } from "@/lib/london-time";

export type BreakdownRow = {
  settlement_date: string;
  category: BreakdownCategory;
  cost_gbp: number;
  volume_mwh: number;
};

export type DayAheadRow = {
  boundary: (typeof CONSTRAINT_BOUNDARIES)[number];
  settlement_date: string;
  wall_time: string;
  interval_start: string;
  limit_mw: number;
  flow_mw: number;
};

export type ParseFailureReason =
  | "empty"
  | "header"
  | "unknown_column"
  | "unknown_boundary"
  | "row"
  | "clock";

export type ParsedBreakdown =
  | { ok: true; rows: BreakdownRow[]; rowCount: number }
  | { ok: false; reason: ParseFailureReason };

export type ParsedDayAhead =
  | { ok: true; rows: DayAheadRow[]; rowCount: number; retainedDates: string[] }
  | { ok: false; reason: ParseFailureReason };

const SETTLEMENT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function nesoFinancialYear(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${start + 1}`;
}

export function breakdownResourceName(financialYear: string): string {
  return `Constraint Breakdown ${financialYear}`;
}

export function sha256Text(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function sameHeader(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  return actual.every((cell, index) => cell === expected[index]);
}

export function parseBreakdownCsv(text: string): ParsedBreakdown {
  const table = csvRows(text);
  if (table.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const header = table[0];
  if (!header) {
    return { ok: false, reason: "empty" };
  }
  if (header.length !== BREAKDOWN_HEADER.length) {
    return { ok: false, reason: header.length > BREAKDOWN_HEADER.length ? "unknown_column" : "header" };
  }
  if (!sameHeader(header, BREAKDOWN_HEADER)) {
    return { ok: false, reason: "header" };
  }
  const body = table.slice(1);
  if (body.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const rows: BreakdownRow[] = [];
  const seen = new Set<string>();
  for (const cells of body) {
    if (cells.some((cell) => cell.includes('"'))) {
      return { ok: false, reason: "row" };
    }
    if (cells.length !== BREAKDOWN_HEADER.length) {
      return { ok: false, reason: cells.length > BREAKDOWN_HEADER.length ? "unknown_column" : "row" };
    }
    const settlement = cells[0] ?? "";
    if (!SETTLEMENT_DATE.test(settlement) || seen.has(settlement)) {
      return { ok: false, reason: "row" };
    }
    seen.add(settlement);
    for (const category of BREAKDOWN_CATEGORIES) {
      const cost = parsePublishedNumber(cells[breakdownCostIndex(category)] ?? "");
      const volume = parsePublishedNumber(cells[breakdownVolumeIndex(category)] ?? "");
      if (cost == null || volume == null) {
        return { ok: false, reason: "row" };
      }
      rows.push({
        settlement_date: settlement,
        category,
        cost_gbp: cost,
        volume_mwh: volume,
      });
    }
  }
  return { ok: true, rows, rowCount: body.length };
}

function wallToUtc(wall: string, previous: string | null): string | null {
  const match = WALL_TIME.exec(wall);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] == null || match[6] === "" ? 0 : Number(match[6]);
  if (second !== 0 || (minute !== 0 && minute !== 30)) {
    return null;
  }
  let instant = londonDateTimeToUtc(year, month, day, hour, minute, second).toISOString();
  if (previous != null && instant <= previous) {
    const shifted = new Date(new Date(instant).getTime() + 60 * 60 * 1000).toISOString();
    if (shifted <= previous) {
      return null;
    }
    instant = shifted;
  }
  return instant;
}

export function parseDayAheadCsv(text: string): ParsedDayAhead {
  const table = csvRows(text);
  if (table.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const header = table[0];
  if (!header) {
    return { ok: false, reason: "empty" };
  }
  if (header.length !== DAY_AHEAD_HEADER.length) {
    return { ok: false, reason: header.length > DAY_AHEAD_HEADER.length ? "unknown_column" : "header" };
  }
  if (!sameHeader(header, DAY_AHEAD_HEADER)) {
    return { ok: false, reason: "header" };
  }
  const body = table.slice(1);
  if (body.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const dates = new Set<string>();
  const staged: Array<{ boundary: string; settlement: string; wall: string; limit: number; flow: number }> = [];
  for (const cells of body) {
    if (cells.length !== DAY_AHEAD_HEADER.length) {
      return { ok: false, reason: cells.length > DAY_AHEAD_HEADER.length ? "unknown_column" : "row" };
    }
    const boundary = cells[0] ?? "";
    if (!isConstraintBoundary(boundary)) {
      return { ok: false, reason: "unknown_boundary" };
    }
    const wall = cells[1] ?? "";
    const settlement = wall.slice(0, 10);
    if (!SETTLEMENT_DATE.test(settlement)) {
      return { ok: false, reason: "row" };
    }
    const limitCell = (cells[2] ?? "").trim();
    const flowCell = (cells[3] ?? "").trim();
    if (limitCell === "" || flowCell === "") {
      continue;
    }
    const limit = parsePublishedNumber(limitCell);
    const flow = parsePublishedNumber(flowCell);
    if (limit == null || flow == null) {
      return { ok: false, reason: "row" };
    }
    dates.add(settlement);
    staged.push({ boundary, settlement, wall, limit, flow });
  }
  const retainedDates = [...dates].sort().slice(-DAY_AHEAD_RETAINED_DATES);
  const retained = new Set(retainedDates);
  const rows: DayAheadRow[] = [];
  const previousByBoundary = new Map<string, string>();
  for (const row of staged) {
    if (!retained.has(row.settlement)) {
      continue;
    }
    const previous = previousByBoundary.get(row.boundary) ?? null;
    const interval = wallToUtc(row.wall, previous);
    if (!interval || !isConstraintBoundary(row.boundary)) {
      return { ok: false, reason: "clock" };
    }
    if (previous != null && interval <= previous) {
      return { ok: false, reason: "clock" };
    }
    previousByBoundary.set(row.boundary, interval);
    rows.push({
      boundary: row.boundary,
      settlement_date: row.settlement,
      wall_time: row.wall,
      interval_start: interval,
      limit_mw: row.limit,
      flow_mw: row.flow,
    });
  }
  if (rows.length === 0) {
    return { ok: false, reason: "empty" };
  }
  return { ok: true, rows, rowCount: body.length, retainedDates };
}
