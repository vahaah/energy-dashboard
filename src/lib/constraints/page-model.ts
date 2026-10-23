import { displayedPercents } from "@/lib/display-rounding";
import { BREAKDOWN_CATEGORIES, BREAKDOWN_CATEGORY_LABEL, type BreakdownCategory } from "@/lib/constraints/categories";
import {
  measuredCostChart,
  measuredVolumeChart,
  type CostChartPoint,
  type MeasuredCostChartSeries,
  type MeasuredVolumeChartSeries,
  type VolumeChartPoint,
} from "@/lib/constraints/chart-series";
import { dayAheadIssuedLabel, measuredBreakdownLagNote } from "@/lib/constraints/copy";
import { formatLondonDateTimeStamp, getLondonDate } from "@/lib/london-time";
import type { ConstraintRelease } from "@/lib/constraints/release";

export type CategoryTableRow = {
  category: BreakdownCategory;
  label: string;
  gbp: number;
  mwh: number;
  share: number | null;
};

export type BoundaryDay = {
  boundary: string;
  latestWall: string;
  latestFlow: number;
  latestLimit: number;
  intervals: { wall: string; flow: number; limit: number }[];
};

export type ConstraintsPageModel = {
  available: boolean;
  financialYear: string | null;
  earlierReleaseKept: boolean;
  cost: MeasuredCostChartSeries | null;
  volume: MeasuredVolumeChartSeries | null;
  latest: {
    settlementDate: string;
    rows: CategoryTableRow[];
    totalGbp: number;
    totalMwh: number;
  } | null;
  dayAhead: {
    issuedLabel: string;
    settlementDate: string;
    boundaries: BoundaryDay[];
  } | null;
  publishingLag: string | null;
};

const EMPTY: ConstraintsPageModel = {
  available: false,
  financialYear: null,
  earlierReleaseKept: false,
  cost: null,
  volume: null,
  latest: null,
  dayAhead: null,
  publishingLag: null,
};

export function buildConstraintsPage(input: {
  breakdown: ConstraintRelease | null;
  breakdownPrevious: ConstraintRelease | null;
  dayAhead: ConstraintRelease | null;
  now?: Date;
}): ConstraintsPageModel {
  const breakdown = input.breakdown?.bundle === "breakdown" ? input.breakdown : null;
  const dayAhead = input.dayAhead?.bundle === "day-ahead" ? input.dayAhead : null;
  if (!breakdown && !dayAhead) {
    return EMPTY;
  }
  const cost = breakdown ? costSeries(breakdown) : null;
  const volume = breakdown ? volumeSeries(breakdown) : null;
  return {
    available: true,
    financialYear: breakdown?.financial_year ?? null,
    earlierReleaseKept: Boolean(
      breakdown &&
        input.breakdownPrevious &&
        input.breakdownPrevious.extract_sha256 !== breakdown.extract_sha256 &&
        input.breakdownPrevious.period_key === breakdown.period_key,
    ),
    cost,
    volume,
    latest: breakdown ? latestBreakdown(breakdown) : null,
    dayAhead: dayAhead ? dayAheadTable(dayAhead) : null,
    publishingLag: breakdown ? publishingLag(latestSettlement(breakdown), input.now) : null,
  };
}

function latestSettlement(release: ConstraintRelease): string | null {
  const dates = [...new Set(release.breakdown.map((row) => row.settlement_date))].sort();
  return dates[dates.length - 1] ?? null;
}

function publishingLag(settlementDate: string | null, now: Date | undefined): string | null {
  if (!settlementDate || !now) {
    return null;
  }
  const today = getLondonDate(now);
  const from = Date.parse(`${settlementDate}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }
  const days = Math.round((to - from) / 86_400_000);
  if (days <= 7) {
    return null;
  }
  return measuredBreakdownLagNote(settlementDate);
}

function costSeries(release: ConstraintRelease): MeasuredCostChartSeries {
  if (release.bundle !== "breakdown") {
    throw new Error("A forecast series cannot render on a measured chart");
  }
  return measuredCostChart({ kind: "measured", unit: "GBP", points: widePoints(release, "cost_gbp") });
}

function volumeSeries(release: ConstraintRelease): MeasuredVolumeChartSeries {
  if (release.bundle !== "breakdown") {
    throw new Error("A forecast series cannot render on a measured chart");
  }
  return measuredVolumeChart({ kind: "measured", unit: "MWh", points: widePoints(release, "volume_mwh") });
}

function widePoints(release: ConstraintRelease, field: "cost_gbp" | "volume_mwh"): CostChartPoint[] {
  const byDate = new Map<string, CostChartPoint>();
  for (const row of release.breakdown) {
    const point = byDate.get(row.settlement_date) ?? emptyPoint(row.settlement_date);
    point[row.category] = row[field];
    byDate.set(row.settlement_date, point);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function emptyPoint(date: string): CostChartPoint & VolumeChartPoint {
  return {
    date,
    reducing_largest_loss: 0,
    increasing_system_inertia: 0,
    voltage: 0,
    thermal: 0,
  };
}

function latestBreakdown(release: ConstraintRelease): ConstraintsPageModel["latest"] {
  const dates = [...new Set(release.breakdown.map((row) => row.settlement_date))].sort();
  const settlementDate = dates[dates.length - 1];
  if (!settlementDate) {
    return null;
  }
  const rows = release.breakdown.filter((row) => row.settlement_date === settlementDate);
  const byCategory = new Map(rows.map((row) => [row.category, row]));
  if (BREAKDOWN_CATEGORIES.some((category) => !byCategory.has(category))) {
    return null;
  }
  const ordered = BREAKDOWN_CATEGORIES.map((category) => byCategory.get(category)!);
  const totalGbp = ordered.reduce((sum, row) => sum + row.cost_gbp, 0);
  const totalMwh = ordered.reduce((sum, row) => sum + row.volume_mwh, 0);
  const shares =
    ordered.every((row) => row.cost_gbp >= 0) && totalGbp > 0
      ? displayedPercents(ordered.map((row) => (row.cost_gbp / totalGbp) * 100))
      : null;
  return {
    settlementDate,
    totalGbp,
    totalMwh,
    rows: ordered.map((row, index) => ({
      category: row.category,
      label: BREAKDOWN_CATEGORY_LABEL[row.category],
      gbp: row.cost_gbp,
      mwh: row.volume_mwh,
      share: shares ? (shares[index] ?? null) : null,
    })),
  };
}

function dayAheadTable(release: ConstraintRelease): ConstraintsPageModel["dayAhead"] {
  const dates = [...new Set(release.day_ahead.map((row) => row.settlement_date))].sort();
  const settlementDate = dates[dates.length - 1];
  if (!settlementDate) {
    return null;
  }
  const rows = release.day_ahead.filter((row) => row.settlement_date === settlementDate);
  const byBoundary = new Map<string, BoundaryDay>();
  for (const row of rows) {
    const current = byBoundary.get(row.boundary) ?? {
      boundary: row.boundary,
      latestWall: row.wall_time,
      latestFlow: row.flow_mw,
      latestLimit: row.limit_mw,
      intervals: [],
    };
    current.intervals.push({ wall: row.wall_time.slice(11, 16), flow: row.flow_mw, limit: row.limit_mw });
    current.latestWall = row.wall_time.slice(11, 16);
    current.latestFlow = row.flow_mw;
    current.latestLimit = row.limit_mw;
    byBoundary.set(row.boundary, current);
  }
  const issued = new Date(release.issued_at);
  return {
    issuedLabel: dayAheadIssuedLabel(formatLondonDateTimeStamp(issued)),
    settlementDate,
    boundaries: [...byBoundary.values()].sort((left, right) => left.boundary.localeCompare(right.boundary)),
  };
}
