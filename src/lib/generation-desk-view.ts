import {
  formatSettlementWindow,
  GENERATION_STACK_FUELS,
  groupGenerationMw,
  isInterconnectorFuel,
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
import type { Generation5min, TimeRange } from "@/lib/types";

export const GENERATION_DESK_RANGE_OPTIONS: ReadonlyArray<{
  value: TimeRange;
  label: string;
}> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
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

export type DemandBalanceChartPoint = {
  time: string;
  demandGw: number | null;
  generationGw: number | null;
  gapBaseGw: number | null;
  importGw: number | null;
  exportGw: number | null;
  embeddedMissing: DemandBalancePoint["embeddedMissing"];
};

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
      gapBaseGw,
      importGw: demandGw > generationGw ? demandGw - generationGw : 0,
      exportGw: generationGw > demandGw ? generationGw - demandGw : 0,
      embeddedMissing: point.embeddedMissing,
    };
  });
}

export function gwAxisTicks(maxGw: number): number[] {
  const ceiling = Math.max(10, Math.ceil(maxGw / 10) * 10);
  const step = ceiling <= 50 ? 10 : ceiling <= 100 ? 20 : 25;
  const ticks: number[] = [];
  for (let value = 0; value <= ceiling; value += step) {
    ticks.push(value);
  }
  return ticks;
}

export function demandBalanceYTicks(points: DemandBalanceChartPoint[]): number[] {
  let maxGw = 0;
  for (const point of points) {
    maxGw = Math.max(maxGw, point.demandGw ?? 0, point.generationGw ?? 0);
  }
  return gwAxisTicks(maxGw);
}

export function demandBalanceXTicks(times: string[], range: TimeRange): string[] {
  if (times.length === 0) {
    return [];
  }

  const dated = times.map((time) => ({
    time,
    parts: getLondonDateTimeParts(parseUtcDateTime(time)),
  }));

  switch (range) {
    case "24h": {
      const everyThreeHours = dated
        .filter((entry) => entry.parts.minute === 0 && entry.parts.hour % 3 === 0)
        .map((entry) => entry.time);
      return everyThreeHours.length > 0 ? everyThreeHours : pickEvenly(times, 5);
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
      return days;
    }
    case "30d":
    case "90d": {
      return dated
        .filter((_, index) => index % 5 === 0 || index === dated.length - 1)
        .map((entry) => entry.time);
    }
    case "1y": {
      const monthStarts = dated
        .filter((entry) => entry.parts.day === 1)
        .map((entry) => entry.time);
      return monthStarts.length > 0 ? monthStarts : pickEvenly(times, 6);
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
