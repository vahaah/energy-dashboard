import {
  formatSettlementWindow,
  GENERATION_STACK_FUELS,
  groupGenerationMw,
  isEmbeddedFuel,
  isInterconnectorFuel,
  latestFuelinstTimestamp,
  mapGenerationFuelToStackKey,
  splitLatestGenerationRows,
  type DemandBalancePoint,
  type GenerationStackFuel,
} from "@/lib/dashboard-model";
import { formatHeadlineGw, type Fact, type LatestFacts } from "@/lib/facts";
import {
  formatLondonClock,
  getLondonDateTimeParts,
  getLondonOffsetLabel,
  parseUtcDateTime,
} from "@/lib/london-time";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";

export const FUELINST_STALE_MS = 30 * 60 * 1000;
export const COMPACT_CHART_MAX_TICKS = 4;

export const GENERATION_DESK_RANGE_OPTIONS: ReadonlyArray<{
  value: TimeRange;
  label: string;
}> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
];

export const NOW_SOURCE_FUELS = GENERATION_STACK_FUELS.filter(
  (fuel) => fuel !== "imports"
);

export type NowSourceRow = {
  fuel: string;
  mw: number | null;
  gwLabel: string;
  demandPctLabel: string;
  barPct: number;
  missingNote: string | null;
};

export type NowBySourceView = {
  rows: NowSourceRow[];
  stacked: Array<{ fuel: string; mw: number; pct: number }>;
  totalMw: number;
  totalGwLabel: string;
  totalDemandPctLabel: string;
};

export type GenerationAnswerStat = {
  stat: "generating" | "demand" | "net_imports";
  label: string;
  value: string;
  unit: "GW";
  datetime: string | null;
  timeLabel: string | null;
  source: string;
};

export type GenerationDeskView = {
  answers: GenerationAnswerStat[];
  nowView: NowBySourceView;
  delayNote: string | null;
  alignmentNote: string | null;
};

export type DemandBalanceChartPoint = {
  time: string;
  demandGw: number | null;
  generationGw: number | null;
  demandDailyGw: number | null;
  generationDailyGw: number | null;
  gapBaseGw: number | null;
  importGw: number | null;
  exportGw: number | null;
  embeddedMissing: DemandBalancePoint["embeddedMissing"];
};

export const ROLLING_AVERAGE_DAYS = 7;

export function formatPlainSettlementWindow(timestamp: string): string {
  return formatSettlementWindow(timestamp).replace(/^SP \d+, /, "");
}

export function buildGenerationAnswerStats(facts: LatestFacts): GenerationAnswerStat[] {
  return [
    answerStat("generating", "Generating", facts.generationMw),
    answerStat("demand", "Demand", facts.demand),
    answerStat("net_imports", "Net imports", facts.netImportsMw),
  ];
}

export function buildGenerationDeskView(
  facts: LatestFacts,
  now: Date,
  snapshots: EnergySnapshot[] = []
): GenerationDeskView {
  const aligned = alignAnswerPeriod(facts, snapshots);
  return {
    answers: buildGenerationAnswerStats({
      ...facts,
      generationMw: aligned.generationMw,
      demand: aligned.demand,
      netImportsMw: aligned.netImportsMw,
      generationRows: aligned.generationRows,
    }),
    nowView: buildNowBySourceView(aligned.generationRows, aligned.demand.value),
    delayNote: facts.isHistorical ? null : fuelinstDelayNote(facts.generationRows, now),
    alignmentNote: aligned.alignmentNote,
  };
}

export function fuelinstDelayNote(rows: Generation5min[], now: Date): string | null {
  const timestamp = latestFuelinstTimestamp(rows);
  if (!timestamp) {
    return null;
  }

  const ageMs = now.getTime() - parseUtcDateTime(timestamp).getTime();
  if (ageMs <= FUELINST_STALE_MS) {
    return null;
  }

  return `Data delayed: last Elexon update ${formatLondonClock(parseUtcDateTime(timestamp))}`;
}

export function alignAnswerPeriod(
  facts: LatestFacts,
  snapshots: EnergySnapshot[] = []
): {
  generationMw: Fact<number>;
  demand: Fact<number>;
  netImportsMw: Fact<number>;
  generationRows: Generation5min[];
  alignmentNote: string | null;
} {
  const preferredTimestamp = latestFuelinstTimestamp(facts.generationRows);
  const demandTimestamp = facts.demand.periodStartUtc;
  if (!preferredTimestamp || facts.demand.value == null || !demandTimestamp) {
    return {
      generationMw: facts.generationMw,
      demand: facts.demand,
      netImportsMw: facts.netImportsMw,
      generationRows: facts.generationRows,
      alignmentNote: null,
    };
  }

  const preferredStart = settlementStartMs(preferredTimestamp);
  const demandStart = settlementStartMs(demandTimestamp);
  if (preferredStart === demandStart) {
    return stampAlignedPeriod(
      facts,
      facts.generationRows,
      preferredTimestamp,
      facts.generationMw.value,
      facts.demand.value,
      null
    );
  }

  if (demandStart > preferredStart) {
    const periodDemand = demandInPeriod(snapshots, preferredStart);
    return stampAlignedPeriod(
      facts,
      facts.generationRows,
      preferredTimestamp,
      facts.generationMw.value,
      periodDemand,
      periodDemand == null
        ? `Demand is ${formatPlainSettlementWindow(demandTimestamp)}. Generation is ${formatPlainSettlementWindow(preferredTimestamp)}. Shares of demand are hidden.`
        : null
    );
  }

  const alignedTimestamp = latestFuelinstAtOrBefore(facts.generationRows, demandStart);
  if (!alignedTimestamp) {
    return {
      generationMw: facts.generationMw,
      demand: facts.demand,
      netImportsMw: facts.netImportsMw,
      generationRows: facts.generationRows,
      alignmentNote: null,
    };
  }

  const generationRows = rowsAtOrBeforeFuelinst(facts.generationRows, alignedTimestamp);
  const split = splitLatestGenerationRows(generationRows);
  return stampAlignedPeriod(
    facts,
    generationRows,
    alignedTimestamp,
    split.sources.length > 0 ? split.totalGenerationMw : null,
    facts.demand.value,
    `Demand for ${formatPlainSettlementWindow(preferredTimestamp)} is not in yet. Figures are ${formatPlainSettlementWindow(alignedTimestamp)}.`
  );
}

export function buildNowBySourceView(
  generationRows: Generation5min[],
  demandMw: number | null
): NowBySourceView {
  const split = splitLatestGenerationRows(generationRows);
  const grouped = groupGenerationMw(split.sources);
  const lastSeen = lastSeenByStackFuel(generationRows);
  const totalMw = split.totalGenerationMw;
  const present: NowSourceRow[] = [];
  const missing: NowSourceRow[] = [];

  for (const fuel of NOW_SOURCE_FUELS) {
    if (Object.hasOwn(grouped, fuel)) {
      present.push(sourceRow(fuel, grouped[fuel], demandMw, null));
      continue;
    }

    missing.push(
      sourceRow(fuel, null, demandMw, missingNote(lastSeen[fuel] ?? null))
    );
  }

  const rows = [
    ...present.sort((left, right) => (right.mw ?? 0) - (left.mw ?? 0)),
    ...missing,
  ];

  const stacked = present
    .filter((row) => row.mw != null && row.mw > 0)
    .sort((left, right) => (right.mw ?? 0) - (left.mw ?? 0))
    .map((row) => ({
      fuel: row.fuel,
      mw: row.mw ?? 0,
      pct: totalMw > 0 ? ((row.mw ?? 0) / totalMw) * 100 : 0,
    }));

  return {
    rows,
    stacked,
    totalMw,
    totalGwLabel: formatHeadlineGw(totalMw === 0 && split.sources.length === 0 ? null : totalMw),
    totalDemandPctLabel: demandPctLabel(totalMw, demandMw),
  };
}

export function buildDemandBalanceChartPoints(
  series: DemandBalancePoint[]
): DemandBalanceChartPoint[] {
  return series.map((point) => {
    const demandGw = mwToGw(point.demandMw);
    const generationGw = mwToGw(point.domesticGenerationMw);
    if (demandGw == null || generationGw == null) {
      return {
        time: point.time,
        demandGw,
        generationGw,
        demandDailyGw: null,
        generationDailyGw: null,
        gapBaseGw: null,
        importGw: null,
        exportGw: null,
        embeddedMissing: point.embeddedMissing,
      };
    }

    const gapBaseGw = Math.min(demandGw, generationGw);
    return {
      time: point.time,
      demandGw,
      generationGw,
      demandDailyGw: null,
      generationDailyGw: null,
      gapBaseGw,
      importGw: demandGw > generationGw ? demandGw - generationGw : 0,
      exportGw: generationGw > demandGw ? generationGw - demandGw : 0,
      embeddedMissing: point.embeddedMissing,
    };
  });
}

export function usesLongRangeSmoothing(range: TimeRange): boolean {
  switch (range) {
    case "90d":
    case "1y":
      return true;
    case "24h":
    case "7d":
    case "30d":
      return false;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function prepareDemandBalanceChartData(
  series: DemandBalancePoint[],
  range: TimeRange
): DemandBalanceChartPoint[] {
  const points = clipTrailingEmptyChartPoints(buildDemandBalanceChartPoints(series));
  const trimmed = range === "24h" ? dropLeadingIncompleteChartPoints(points) : points;
  return usesLongRangeSmoothing(range)
    ? applyRollingAverage(trimmed, ROLLING_AVERAGE_DAYS)
    : trimmed;
}

export function dropLeadingIncompleteChartPoints(
  points: DemandBalanceChartPoint[]
): DemandBalanceChartPoint[] {
  const start = points.findIndex(isCompletePlottedPoint);
  if (start <= 0) {
    return points;
  }
  return points.slice(start);
}

export function applyRollingAverage(
  points: DemandBalanceChartPoint[],
  window: number
): DemandBalanceChartPoint[] {
  const demandSmooth = rollingMean(
    points.map((point) => point.demandGw),
    window
  );
  const generationSmooth = rollingMean(
    points.map((point) => point.generationGw),
    window
  );

  return points.map((point, index) =>
    withGap(
      {
        ...point,
        demandDailyGw: point.demandGw,
        generationDailyGw: point.generationGw,
        demandGw: demandSmooth[index] ?? null,
        generationGw: generationSmooth[index] ?? null,
      }
    )
  );
}

export function clipTrailingEmptyChartPoints(
  points: DemandBalanceChartPoint[]
): DemandBalanceChartPoint[] {
  let lastData = -1;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point && (point.demandGw != null || point.generationGw != null)) {
      lastData = index;
    }
  }

  if (lastData === -1) {
    return [];
  }

  return points.slice(0, lastData + 1);
}

export function gwAxisTicks(maxGw: number): number[] {
  const rawCeiling = Math.max(10, Math.ceil(maxGw / 10) * 10);
  let step = 25;
  if (rawCeiling <= 50) {
    step = 10;
  } else if (rawCeiling <= 100) {
    step = 20;
  }
  const ceiling = Math.ceil(rawCeiling / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= ceiling; value += step) {
    ticks.push(value);
  }
  return ticks;
}

export function demandBalanceYTicks(points: DemandBalanceChartPoint[]): number[] {
  let maxGw = 0;
  for (const point of points) {
    maxGw = Math.max(
      maxGw,
      point.demandGw ?? 0,
      point.generationGw ?? 0,
      point.demandDailyGw ?? 0,
      point.generationDailyGw ?? 0
    );
  }
  return gwAxisTicks(maxGw);
}

export function demandBalanceXTicks(
  times: string[],
  range: TimeRange,
  compact = false
): string[] {
  if (times.length === 0) {
    return [];
  }

  const dated = times.map((time) => ({
    time,
    parts: getLondonDateTimeParts(parseUtcDateTime(time)),
  }));
  const hourStep = compact ? 6 : 3;

  switch (range) {
    case "24h": {
      const hourly = dated
        .filter((entry) => entry.parts.minute === 0 && entry.parts.hour % hourStep === 0)
        .map((entry) => entry.time);
      const ticks = hourly.length > 0 ? hourly : pickEvenly(times, compact ? 4 : 5);
      return compact ? capTicks(ticks, COMPACT_CHART_MAX_TICKS) : ticks;
    }
    case "7d": {
      const days: string[] = [];
      let previousDay: string | null = null;
      for (const entry of dated) {
        const dayKey = `${entry.parts.year}-${entry.parts.month}-${entry.parts.day}`;
        if (dayKey === previousDay) {
          continue;
        }
        days.push(entry.time);
        previousDay = dayKey;
      }
      return compact ? capTicks(days, COMPACT_CHART_MAX_TICKS) : days;
    }
    case "30d":
    case "90d": {
      const ticks = dated
        .filter((_, index) => index % 5 === 0 || index === dated.length - 1)
        .map((entry) => entry.time);
      return compact ? capTicks(ticks, COMPACT_CHART_MAX_TICKS) : ticks;
    }
    case "1y": {
      const monthStarts = dated
        .filter((entry) => entry.parts.day === 1)
        .map((entry) => entry.time);
      const ticks = monthStarts.length > 0 ? monthStarts : pickEvenly(times, 6);
      return compact ? capTicks(ticks, COMPACT_CHART_MAX_TICKS) : ticks;
    }
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function formatDemandBalanceTick(timestamp: string, range: TimeRange): string {
  const date = parseUtcDateTime(timestamp);
  const parts = getLondonDateTimeParts(date);
  const month = LONDON_MONTHS[parts.month - 1];
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");

  switch (range) {
    case "24h":
      return `${hour}:${minute}`;
    case "7d":
    case "30d":
    case "90d":
      return `${parts.day} ${month}`;
    case "1y":
      return month;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function formatDemandBalanceTooltipLabel(
  timestamp: string,
  range: TimeRange
): string {
  const date = parseUtcDateTime(timestamp);
  const parts = getLondonDateTimeParts(date);
  const month = LONDON_MONTHS[parts.month - 1];
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  const zone = getLondonOffsetLabel(date);

  switch (range) {
    case "24h":
    case "7d":
      return `${parts.day} ${month} ${hour}:${minute} ${zone}`;
    case "30d":
    case "90d":
    case "1y":
      return `${parts.day} ${month} ${parts.year}`;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function demandBalanceGapLabel(point: DemandBalanceChartPoint): string | null {
  if (point.importGw == null || point.exportGw == null) {
    return null;
  }
  if (point.importGw > 0) {
    return `Imports (demand above generation): ${point.importGw.toFixed(1)} GW`;
  }
  if (point.exportGw > 0) {
    return `Exports (generation above demand): ${point.exportGw.toFixed(1)} GW`;
  }
  return "Gap: 0.0 GW";
}

export function lastDefinedIndex(
  points: DemandBalanceChartPoint[],
  key: "demandGw" | "generationGw"
): number {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index]?.[key] != null) {
      return index;
    }
  }
  return -1;
}

function answerStat(
  stat: GenerationAnswerStat["stat"],
  label: string,
  fact: Fact<number>
): GenerationAnswerStat {
  const timestamp = fact.periodStartUtc;
  return {
    stat,
    label,
    value: formatHeadlineGw(fact.value),
    unit: "GW",
    datetime: timestamp,
    timeLabel: timestamp ? formatPlainSettlementWindow(timestamp) : null,
    source: fact.source,
  };
}

function sourceRow(
  fuel: string,
  mw: number | null,
  demandMw: number | null,
  missingNote: string | null
): NowSourceRow {
  return {
    fuel,
    mw,
    gwLabel: formatHeadlineGw(mw),
    demandPctLabel: demandPctLabel(mw, demandMw),
    barPct: demandBarPct(mw, demandMw),
    missingNote,
  };
}

function demandPctLabel(mw: number | null, demandMw: number | null): string {
  if (mw == null || demandMw == null || demandMw <= 0) {
    return "—";
  }
  return `${((mw / demandMw) * 100).toFixed(1)}%`;
}

function demandBarPct(mw: number | null, demandMw: number | null): number {
  if (mw == null || demandMw == null || demandMw <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (mw / demandMw) * 100));
}

function missingNote(timestamp: string | null): string {
  if (!timestamp) {
    return "no data";
  }
  return `no data since ${formatLondonClock(parseUtcDateTime(timestamp))}`;
}

function lastSeenByStackFuel(
  rows: Generation5min[]
): Partial<Record<GenerationStackFuel, string>> {
  const lastSeen: Partial<Record<GenerationStackFuel, string>> = {};

  for (const row of rows) {
    if (isInterconnectorFuel(row.fuel_type)) {
      continue;
    }

    const fuel = mapGenerationFuelToStackKey(row.fuel_type);
    if (!isNowSourceFuel(fuel)) {
      continue;
    }

    const existing = lastSeen[fuel];
    if (!existing || row.timestamp > existing) {
      lastSeen[fuel] = row.timestamp;
    }
  }

  return lastSeen;
}

function isNowSourceFuel(fuel: string): fuel is (typeof NOW_SOURCE_FUELS)[number] {
  for (const candidate of NOW_SOURCE_FUELS) {
    if (candidate === fuel) {
      return true;
    }
  }
  return false;
}

function mwToGw(valueMw: number | null): number | null {
  if (valueMw == null) {
    return null;
  }
  return valueMw / 1000;
}

function stampAlignedPeriod(
  facts: LatestFacts,
  generationRows: Generation5min[],
  timestamp: string,
  generationValue: number | null,
  demandValue: number | null,
  alignmentNote: string | null
): {
  generationMw: Fact<number>;
  demand: Fact<number>;
  netImportsMw: Fact<number>;
  generationRows: Generation5min[];
  alignmentNote: string | null;
} {
  const split = splitLatestGenerationRows(generationRows);
  const bounds = settlementBounds(timestamp);
  return {
    generationMw: {
      ...facts.generationMw,
      value: generationValue,
      periodStartUtc: bounds.startUtc,
      periodEndUtc: bounds.endUtc,
    },
    demand: {
      ...facts.demand,
      value: demandValue,
      periodStartUtc: bounds.startUtc,
      periodEndUtc: bounds.endUtc,
    },
    netImportsMw: {
      ...facts.netImportsMw,
      value: netImportsInPeriod(split.interconnectors, timestamp),
      periodStartUtc: bounds.startUtc,
      periodEndUtc: bounds.endUtc,
    },
    generationRows,
    alignmentNote,
  };
}

function demandInPeriod(snapshots: EnergySnapshot[], periodStartMs: number): number | null {
  let latest: number | null = null;
  let latestTimestamp: string | null = null;

  for (const snapshot of snapshots) {
    if (snapshot.demand_mw == null) {
      continue;
    }
    if (settlementStartMs(snapshot.timestamp) !== periodStartMs) {
      continue;
    }
    if (!latestTimestamp || snapshot.timestamp > latestTimestamp) {
      latest = snapshot.demand_mw;
      latestTimestamp = snapshot.timestamp;
    }
  }

  return latest;
}

function netImportsInPeriod(rows: Generation5min[], timestamp: string): number | null {
  const periodStart = settlementStartMs(timestamp);
  let total = 0;
  let count = 0;

  for (const row of rows) {
    if (settlementStartMs(row.timestamp) !== periodStart) {
      continue;
    }
    total += row.generation_mw;
    count += 1;
  }

  return count > 0 ? total : null;
}

function isCompletePlottedPoint(point: DemandBalanceChartPoint): boolean {
  return point.generationGw != null && point.embeddedMissing.length === 0;
}

function rollingMean(values: Array<number | null>, window: number): Array<number | null> {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    let sum = 0;
    let count = 0;
    for (let cursor = start; cursor <= index; cursor += 1) {
      const value = values[cursor];
      if (value == null) {
        continue;
      }
      sum += value;
      count += 1;
    }
    return count > 0 ? sum / count : null;
  });
}

function withGap(point: DemandBalanceChartPoint): DemandBalanceChartPoint {
  const demandGw = point.demandGw;
  const generationGw = point.generationGw;
  if (demandGw == null || generationGw == null) {
    return {
      ...point,
      gapBaseGw: null,
      importGw: null,
      exportGw: null,
    };
  }

  return {
    ...point,
    gapBaseGw: Math.min(demandGw, generationGw),
    importGw: demandGw > generationGw ? demandGw - generationGw : 0,
    exportGw: generationGw > demandGw ? generationGw - demandGw : 0,
  };
}

function settlementStartMs(timestamp: string): number {
  return getSettlementPeriod(parseUtcDateTime(timestamp)).startUtc.getTime();
}

function settlementBounds(timestamp: string): { startUtc: string; endUtc: string } {
  const period = getSettlementPeriod(parseUtcDateTime(timestamp));
  return {
    startUtc: period.startUtc.toISOString(),
    endUtc: period.endUtc.toISOString(),
  };
}

function latestFuelinstAtOrBefore(rows: Generation5min[], demandStartMs: number): string | null {
  let latest: string | null = null;

  for (const row of rows) {
    if (isEmbeddedFuel(row.fuel_type)) {
      continue;
    }
    if (settlementStartMs(row.timestamp) > demandStartMs) {
      continue;
    }
    if (!latest || row.timestamp > latest) {
      latest = row.timestamp;
    }
  }

  return latest;
}

function rowsAtOrBeforeFuelinst(rows: Generation5min[], timestamp: string): Generation5min[] {
  return rows.filter((row) => {
    if (isEmbeddedFuel(row.fuel_type)) {
      return true;
    }
    return row.timestamp <= timestamp;
  });
}

function capTicks(ticks: string[], max: number): string[] {
  return pickEvenly(ticks, max);
}

function pickEvenly(values: string[], count: number): string[] {
  if (values.length <= count) {
    return values;
  }

  const lastIndex = values.length - 1;
  const picked: string[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const index = Math.round((slot * lastIndex) / (count - 1));
    const value = values[index];
    if (value && value !== picked.at(-1)) {
      picked.push(value);
    }
  }
  return picked;
}

const LONDON_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
