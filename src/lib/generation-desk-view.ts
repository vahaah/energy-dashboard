import {
  EMBEDDED_CARRY_INTRADAY_MS,
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
  formatLondonDateLabel,
  formatLondonDayMonthYear,
  formatTinybirdDateTime,
  getLondonDateTimeParts,
  getLondonOffsetLabel,
  parseUtcDateTime,
} from "@/lib/london-time";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";

/** /api/cron is hourly. 90 min = one cycle plus grace; health stays at 2.5h. */
export const FUELINST_STALE_MS = 90 * 60 * 1000;
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

export const NOW_SOURCE_FUELS = GENERATION_STACK_FUELS;

export type NowSourceRow = {
  fuel: string;
  mw: number | null;
  gwLabel: string;
  sharePctLabel: string;
  barPct: number;
  missingNote: string | null;
};

export type NowBySourceView = {
  rows: NowSourceRow[];
  stacked: Array<{ fuel: string; mw: number; pct: number }>;
  totalMw: number;
  totalGwLabel: string;
  totalSharePctLabel: string;
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
  sourceCopy: GenerationSourceCopy;
};

export type GenerationSourceCopy = {
  title: string;
  subtitle: string;
  tooltip: string;
  tooltipLabel: string;
};

export type DemandBalanceChartPoint = {
  time: string;
  demandGw: number | null;
  generationGw: number | null;
  demandForecastGw: number | null;
  demandDailyGw: number | null;
  generationDailyGw: number | null;
  gapBaseGw: number | null;
  importGw: number | null;
  exportGw: number | null;
  embeddedMissing: DemandBalancePoint["embeddedMissing"];
};

export const ROLLING_AVERAGE_DAYS = 7;
export const ROLLING_AVERAGE_MIN_DAYS = 4;

export function formatPlainSettlementWindow(timestamp: string): string {
  return formatSettlementWindow(timestamp);
}

export function buildGenerationAnswerStats(facts: LatestFacts): GenerationAnswerStat[] {
  return [
    answerStat("generating", "Generation", facts.generationMw),
    answerStat("demand", "Demand", facts.demand),
    answerStat("net_imports", "Transfers", facts.netImportsMw),
  ];
}

export function buildGenerationDeskView(
  facts: LatestFacts,
  now: Date,
  headlineSnapshots: EnergySnapshot[] = []
): GenerationDeskView {
  const aligned = alignAnswerPeriod(facts, headlineSnapshots);
  return {
    answers: buildGenerationAnswerStats({
      ...facts,
      generationMw: aligned.generationMw,
      demand: aligned.demand,
      netImportsMw: aligned.netImportsMw,
      generationRows: aligned.generationRows,
    }),
    nowView: buildNowBySourceView(aligned.generationRows),
    delayNote: facts.isHistorical ? null : fuelinstDelayNote(facts.generationRows, now),
    alignmentNote: aligned.alignmentNote,
    sourceCopy: generationSourceCopy(
      facts,
      latestFuelinstTimestamp(aligned.generationRows)
    ),
  };
}

export function generationSourceCopy(
  facts: LatestFacts,
  frameTimestamp: string | null = null
): GenerationSourceCopy {
  const preferredTimestamp = latestFuelinstTimestamp(facts.generationRows);
  const fuelinstFrame = frameTimestamp ?? preferredTimestamp;
  const displayedTimestamp = fuelinstFrame ?? facts.generationMw.periodStartUtc;
  const showingLatestLive =
    !facts.isHistorical &&
    fuelinstFrame != null &&
    (frameTimestamp == null || frameTimestamp === preferredTimestamp);
  const carry = embeddedCarryPhrase();

  if (showingLatestLive) {
    return {
      title: "Powering Britain now",
      subtitle: "Now, by source · sorted by size · share of supply",
      tooltip: `GB generation from the latest Elexon FUELINST frame, with embedded wind and solar ${carry}. Net imports are their own slice of total supply.`,
      tooltipLabel: "What is Powering Britain now?",
    };
  }

  const when = displayedTimestamp ? formatSourceWhen(displayedTimestamp) : null;
  const title = when
    ? `Powering Britain at ${when}`
    : `Powering Britain on ${formatLondonDayMonthYear(facts.requestedDate)}`;

  if (!when) {
    return {
      title,
      subtitle: "By source · sorted by size · share of supply",
      tooltip: `No Elexon FUELINST frame is available for ${formatLondonDayMonthYear(facts.requestedDate)}. Net imports are their own slice of total supply.`,
      tooltipLabel: `What is ${title}?`,
    };
  }

  return {
    title,
    subtitle: "By source · sorted by size · share of supply",
    tooltip: `GB generation from the Elexon FUELINST frame at ${when}, with embedded wind and solar ${carry}. Net imports are their own slice of total supply.`,
    tooltipLabel: `What is ${title}?`,
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
  headlineSnapshots: EnergySnapshot[] = []
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
      demand: demandFactIncludingEmbedded(facts.demand, facts.generationRows),
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
    const periodDemand = demandInPeriod(headlineSnapshots, preferredStart);
    return stampAlignedPeriod(
      facts,
      facts.generationRows,
      preferredTimestamp,
      facts.generationMw.value,
      periodDemand,
      periodDemand == null
        ? `Demand is ${formatPlainSettlementWindow(demandTimestamp)}. Generation is ${formatPlainSettlementWindow(preferredTimestamp)}.`
        : null
    );
  }

  const alignedTimestamp = latestFuelinstAtOrBefore(facts.generationRows, demandStart);
  if (!alignedTimestamp) {
    return {
      generationMw: facts.generationMw,
      demand: demandFactIncludingEmbedded(facts.demand, facts.generationRows),
      netImportsMw: facts.netImportsMw,
      generationRows: facts.generationRows,
      alignmentNote: null,
    };
  }

  const generationRows = rowsAtOrBeforeFuelinst(facts.generationRows, alignedTimestamp);
  const split = splitLatestGenerationRows(generationRows);
  const alignedStart = settlementStartMs(alignedTimestamp);
  const periodDemand =
    alignedStart === demandStart
      ? facts.demand.value
      : demandInPeriod(headlineSnapshots, alignedStart);
  let alignmentNote = `Demand for ${formatPlainSettlementWindow(preferredTimestamp)} is not in yet. Figures are ${formatPlainSettlementWindow(alignedTimestamp)}.`;
  if (periodDemand == null && alignedStart !== demandStart) {
    alignmentNote = `Demand is ${formatPlainSettlementWindow(demandTimestamp)}. Generation is ${formatPlainSettlementWindow(alignedTimestamp)}.`;
  }

  return stampAlignedPeriod(
    facts,
    generationRows,
    alignedTimestamp,
    split.sources.length > 0 ? split.totalGenerationMw : null,
    periodDemand,
    alignmentNote
  );
}

export function buildNowBySourceView(generationRows: Generation5min[]): NowBySourceView {
  const split = splitLatestGenerationRows(generationRows);
  const grouped = groupGenerationMw(split.sources);
  const netImportsMw = split.latestTimestamp
    ? netImportsInPeriod(split.interconnectors, split.latestTimestamp)
    : null;
  if (netImportsMw != null && netImportsMw > 0) {
    grouped.imports = netImportsMw;
  } else if (netImportsMw != null) {
    grouped.imports = 0;
  }
  const lastSeen = lastSeenByStackFuel(generationRows);
  const totalMw =
    split.sources.length === 0 && split.interconnectors.length === 0
      ? null
      : Object.values(grouped).reduce((sum, mw) => sum + mw, 0);
  const present: NowSourceRow[] = [];
  const missing: NowSourceRow[] = [];

  for (const fuel of NOW_SOURCE_FUELS) {
    if (Object.hasOwn(grouped, fuel)) {
      present.push(sourceRow(fuel, grouped[fuel], totalMw, null));
      continue;
    }

    missing.push(sourceRow(fuel, null, totalMw, missingNote(lastSeen[fuel] ?? null)));
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
      pct: totalMw != null && totalMw > 0 ? ((row.mw ?? 0) / totalMw) * 100 : 0,
    }));

  return {
    rows,
    stacked,
    totalMw: totalMw ?? 0,
    totalGwLabel: formatHeadlineGw(totalMw),
    totalSharePctLabel: sharePctLabel(totalMw, totalMw),
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
        demandForecastGw: null,
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
      demandForecastGw: null,
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
      return true;
    case "24h":
    case "7d":
    case "30d":
    case "1y":
    case "all":
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
    ? applyRollingAverage(fillDailyCalendarSlots(trimmed), ROLLING_AVERAGE_DAYS)
    : trimmed;
}

export function appendDemandForecastPoints(
  points: DemandBalanceChartPoint[],
  forecast: Array<{ time: string; value: number }>
): DemandBalanceChartPoint[] {
  if (forecast.length === 0) {
    return points;
  }

  const byTime = new Map(points.map((point) => [point.time, { ...point }]));
  for (const row of forecast) {
    const existing = byTime.get(row.time);
    const demandForecastGw = row.value / 1000;
    if (existing) {
      existing.demandForecastGw = demandForecastGw;
      continue;
    }
    byTime.set(row.time, {
      time: row.time,
      demandGw: null,
      generationGw: null,
      demandForecastGw,
      demandDailyGw: null,
      generationDailyGw: null,
      gapBaseGw: null,
      importGw: null,
      exportGw: null,
      embeddedMissing: [],
    });
  }

  return clipTrailingEmptyChartPoints(
    [...byTime.values()].sort(
      (left, right) =>
        parseUtcDateTime(left.time).getTime() - parseUtcDateTime(right.time).getTime()
    )
  );
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

export function fillDailyCalendarSlots(
  points: DemandBalanceChartPoint[]
): DemandBalanceChartPoint[] {
  if (points.length === 0) {
    return points;
  }

  const byDay = new Map<number, DemandBalanceChartPoint>();
  for (const point of points) {
    byDay.set(utcDayStartMs(parseUtcDateTime(point.time)), point);
  }

  const first = utcDayStartMs(parseUtcDateTime(points[0].time));
  const last = utcDayStartMs(parseUtcDateTime(points[points.length - 1].time));
  const filled: DemandBalanceChartPoint[] = [];

  for (let day = first; day <= last; day += UTC_DAY_MS) {
    const existing = byDay.get(day);
    if (existing) {
      filled.push(existing);
      continue;
    }

    filled.push({
      time: formatTinybirdDateTime(new Date(day)),
      demandGw: null,
      generationGw: null,
      demandForecastGw: null,
      demandDailyGw: null,
      generationDailyGw: null,
      gapBaseGw: null,
      importGw: null,
      exportGw: null,
      embeddedMissing: [],
    });
  }

  return filled;
}

export function applyRollingAverage(
  points: DemandBalanceChartPoint[],
  window: number
): DemandBalanceChartPoint[] {
  const smoothed = pairedRollingMeans(
    points.map((point) => point.demandGw),
    points.map((point) => point.generationGw),
    window,
    ROLLING_AVERAGE_MIN_DAYS
  );

  return points.map((point, index) =>
    withGap(
      {
        ...point,
        demandDailyGw: point.demandGw,
        generationDailyGw: point.generationGw,
        demandGw: smoothed.demand[index] ?? null,
        generationGw: smoothed.generation[index] ?? null,
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
    if (
      point &&
      (point.demandGw != null ||
        point.generationGw != null ||
        point.demandForecastGw != null)
    ) {
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
      point.demandForecastGw ?? 0,
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
  switch (range) {
    case "24h": {
      const hourly = dated
        .filter((entry) => entry.parts.minute === 0 && entry.parts.hour % 6 === 0)
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
      const monthStarts: string[] = [];
      let previousMonth: string | null = null;
      for (const entry of dated) {
        const monthKey = `${entry.parts.year}-${entry.parts.month}`;
        if (monthKey === previousMonth) {
          continue;
        }
        monthStarts.push(entry.time);
        previousMonth = monthKey;
      }
      const ticks = monthStarts.length > 0 ? monthStarts : pickEvenly(times, 6);
      return compact ? capTicks(ticks, COMPACT_CHART_MAX_TICKS) : ticks;
    }
    case "all": {
      const yearStarts: string[] = [];
      let previousYear: number | null = null;
      for (const entry of dated) {
        if (entry.parts.year === previousYear) {
          continue;
        }
        yearStarts.push(entry.time);
        previousYear = entry.parts.year;
      }
      const ticks = yearStarts.length > 0 ? yearStarts : pickEvenly(times, 8);
      return compact ? capTicks(ticks, COMPACT_CHART_MAX_TICKS) : ticks;
    }
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function formatDemandBalanceTick(
  timestamp: string,
  range: TimeRange,
  options: { includeDate?: boolean } = {}
): string {
  const date = parseUtcDateTime(timestamp);
  const parts = getLondonDateTimeParts(date);
  const month = LONDON_MONTHS[parts.month - 1];
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");

  switch (range) {
    case "24h":
      if (options.includeDate) {
        return `${parts.day} ${month} ${hour}:${minute}`;
      }
      return `${hour}:${minute}`;
    case "7d":
      return LONDON_WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
    case "30d":
    case "90d":
      return `${parts.day} ${month}`;
    case "1y":
      return month;
    case "all":
      return String(parts.year);
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
    case "all":
      return `${month} ${parts.year}`;
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
  key: "demandGw" | "generationGw" | "demandForecastGw"
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
  supplyMw: number | null,
  missingNote: string | null
): NowSourceRow {
  return {
    fuel,
    mw,
    gwLabel: formatHeadlineGw(mw),
    sharePctLabel: sharePctLabel(mw, supplyMw),
    barPct: supplyBarPct(mw, supplyMw),
    missingNote,
  };
}

function sharePctLabel(mw: number | null, supplyMw: number | null): string {
  if (mw == null || supplyMw == null || supplyMw <= 0) {
    return "—";
  }
  return `${((mw / supplyMw) * 100).toFixed(1)}%`;
}

function supplyBarPct(mw: number | null, supplyMw: number | null): number {
  if (mw == null || supplyMw == null || supplyMw <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (mw / supplyMw) * 100));
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
    const fuel = isInterconnectorFuel(row.fuel_type)
      ? "imports"
      : mapGenerationFuelToStackKey(row.fuel_type);
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

function demandFactIncludingEmbedded(
  demand: Fact<number>,
  generationRows: Generation5min[]
): Fact<number> {
  const contributors = embeddedDemandContributors(generationRows);
  const source = compositeDemandSource(demand.source, contributors);
  return {
    ...demand,
    value: demandIncludingEmbedded(demand.value, generationRows),
    source,
    definition: compositeDemandDefinition(demand.definition, contributors),
  };
}

function embeddedDemandContributors(generationRows: Generation5min[]): {
  wind: boolean;
  solar: boolean;
} {
  const sources = splitLatestGenerationRows(generationRows).sources;
  let wind = false;
  let solar = false;
  for (const row of sources) {
    if (row.fuel_type === "embedded_wind" && row.generation_mw !== 0) {
      wind = true;
    }
    if (row.fuel_type === "embedded_solar" && row.generation_mw !== 0) {
      solar = true;
    }
  }
  return { wind, solar };
}

function compositeDemandSource(
  transmissionSource: string,
  contributors: { wind: boolean; solar: boolean }
): string {
  const names = [transmissionSource];
  if (contributors.wind) {
    names.push("NESO");
  }
  if (contributors.solar) {
    names.push("Sheffield Solar PV Live");
  }
  return names.join(", ");
}

function compositeDemandDefinition(
  transmissionDefinition: string,
  contributors: { wind: boolean; solar: boolean }
): string {
  if (contributors.wind && contributors.solar) {
    return "ITSDO plus estimated embedded wind and solar";
  }
  if (contributors.wind) {
    return "ITSDO plus estimated embedded wind";
  }
  if (contributors.solar) {
    return "ITSDO plus estimated embedded solar";
  }
  return transmissionDefinition;
}

function demandIncludingEmbedded(
  demandMw: number | null,
  generationRows: Generation5min[]
): number | null {
  if (demandMw == null) {
    return null;
  }

  const sources = splitLatestGenerationRows(generationRows).sources;
  let embeddedMw = 0;
  for (const row of sources) {
    if (isEmbeddedFuel(row.fuel_type)) {
      embeddedMw += row.generation_mw;
    }
  }

  return demandMw + embeddedMw;
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
      ...demandFactIncludingEmbedded(facts.demand, split.sources),
      value: demandIncludingEmbedded(demandValue, split.sources),
      periodStartUtc: demandValue == null ? facts.demand.periodStartUtc : bounds.startUtc,
      periodEndUtc: demandValue == null ? facts.demand.periodEndUtc : bounds.endUtc,
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

function formatSourceWhen(timestamp: string): string {
  const date = parseUtcDateTime(timestamp);
  return `${formatLondonClock(date)} on ${formatLondonDateLabel(date)}`;
}

function embeddedCarryPhrase(): string {
  const minutes = Math.round(EMBEDDED_CARRY_INTRADAY_MS / (60 * 1000));
  if (minutes === 60) {
    return "joined at or within one hour";
  }
  return `joined at or within ${minutes} minutes`;
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
  if (rows.length === 0) {
    return null;
  }

  const periodStart = settlementStartMs(timestamp);
  let total = 0;

  for (const row of rows) {
    if (settlementStartMs(row.timestamp) !== periodStart) {
      return null;
    }
    total += row.generation_mw;
  }

  return total;
}

function isCompletePlottedPoint(point: DemandBalanceChartPoint): boolean {
  return point.generationGw != null && point.embeddedMissing.length === 0;
}

function pairedRollingMeans(
  demand: Array<number | null>,
  generation: Array<number | null>,
  window: number,
  minCount: number
): { demand: Array<number | null>; generation: Array<number | null> } {
  const demandOut: Array<number | null> = [];
  const generationOut: Array<number | null> = [];

  for (let index = 0; index < demand.length; index += 1) {
    const start = Math.max(0, index - window + 1);
    let demandSum = 0;
    let generationSum = 0;
    let count = 0;

    for (let cursor = start; cursor <= index; cursor += 1) {
      const demandValue = demand[cursor];
      const generationValue = generation[cursor];
      if (demandValue == null || generationValue == null) {
        continue;
      }
      demandSum += demandValue;
      generationSum += generationValue;
      count += 1;
    }

    const currentComplete = demand[index] != null && generation[index] != null;
    const enough = count >= minCount;
    if (!currentComplete || !enough) {
      demandOut.push(null);
      generationOut.push(null);
      continue;
    }

    demandOut.push(demandSum / count);
    generationOut.push(generationSum / count);
  }

  return { demand: demandOut, generation: generationOut };
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

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStartMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
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

const LONDON_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
