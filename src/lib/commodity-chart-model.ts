import { COMMODITY_COLORS, COMMODITY_LABELS, commodityDisplayIndex } from "@/lib/colors";
import { isMonthlyPublicCommodity, normalizeCommodityUnit } from "@/lib/commodity-series";
import {
  commodityChartValue,
  GB_GAS_SAP_COMMODITY,
} from "@/lib/gb-gas-sap";
import type {
  CommodityChartPoint,
  CommodityChartSeries,
  CommodityPrice,
  CommodityScale,
  CommodityTooltipRow,
  CommodityYAxis,
} from "@/lib/types";

export const COMMODITY_SCALE_OPTIONS = [
  { value: "index", label: "Indexed" },
  { value: "native", label: "Native units" },
] as const;

export const INDEX_LOG_CENTER = 100;
export const INDEX_LOG_BASE = 2;

export function commodityDateKey(date: string): string {
  return date.slice(0, 10);
}

export function commodityTime(date: string): number {
  return Date.parse(`${commodityDateKey(date)}T00:00:00.000Z`);
}

export function commodityDateFromTime(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function isPositiveChartValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function indexToFirstValue(values: Array<number | null>): Array<number | null> {
  const base = values.find((value) => value != null && isPositiveChartValue(value));
  if (base == null) {
    return values.map(() => null);
  }

  return values.map((value) => {
    if (value == null || !isPositiveChartValue(value)) {
      return null;
    }
    return (value / base) * 100;
  });
}

export function formatCommodityNativeUnit(commodity: string, unit: string): string {
  if (commodity === GB_GAS_SAP_COMMODITY) {
    return "p/therm";
  }

  switch (normalizeCommodityUnit(unit)) {
    case "$/BBL":
      return "$/bbl";
    case "$/MMBTU":
      return "$/MMBtu";
    default:
      return unit;
  }
}

export function formatCommodityPointNative(
  point: Pick<CommodityChartPoint, "native" | "unit" | "commodity">
): string {
  const digits = point.commodity === GB_GAS_SAP_COMMODITY ? 1 : 2;
  return `${point.native.toFixed(digits)} ${point.unit}`;
}

export function scaleCaption(scale: CommodityScale): string {
  switch (scale) {
    case "index":
      return "Indexed, start = 100 (log scale)";
    case "native":
      return "Native units";
    default: {
      const exhaustive: never = scale;
      return exhaustive;
    }
  }
}

export function scaleAxisLabel(scale: CommodityScale): string {
  switch (scale) {
    case "index":
      return "Indexed, start = 100 (log scale)";
    case "native":
      return "Native units";
    default: {
      const exhaustive: never = scale;
      return exhaustive;
    }
  }
}

export function logIndexExponent(value: number): number {
  return Math.log2(value / INDEX_LOG_CENTER);
}

export function logIndexTick(exponent: number): number {
  return INDEX_LOG_CENTER * INDEX_LOG_BASE ** exponent;
}

export function indexLogAxis(
  values: number[]
): { domain: [number, number]; ticks: number[] } | null {
  const positive = values.filter((value) => isPositiveChartValue(value));
  if (positive.length === 0) {
    return null;
  }

  const min = Math.min(...positive);
  const max = Math.max(...positive);
  let startExp = Math.floor(logIndexExponent(min));
  let endExp = Math.ceil(logIndexExponent(max));
  if (startExp === endExp) {
    startExp -= 1;
    endExp += 1;
  }

  const ticks: number[] = [];
  for (let exponent = startExp; exponent <= endExp; exponent += 1) {
    ticks.push(logIndexTick(exponent));
  }
  const first = ticks[0];
  const last = ticks.at(-1);
  if (first == null || last == null || first <= 0) {
    return null;
  }
  return { domain: [first, last], ticks };
}

export function commodityYAxis(
  scale: CommodityScale,
  series: CommodityChartSeries[]
): CommodityYAxis {
  switch (scale) {
    case "index": {
      const values = series.flatMap((entry) => entry.points.map((point) => point.value));
      const axis = indexLogAxis(values);
      return {
        scale: "log",
        domain: axis?.domain ?? [50, 200],
        ticks: axis?.ticks ?? [50, 100, 200],
      };
    }
    case "native":
      return { scale: "auto", domain: undefined, ticks: undefined };
    default: {
      const exhaustive: never = scale;
      return exhaustive;
    }
  }
}

export function displaySeriesValue(
  scale: CommodityScale,
  native: number,
  indexed: number | null
): number | null {
  switch (scale) {
    case "index":
      return indexed;
    case "native":
      return native;
    default: {
      const exhaustive: never = scale;
      return exhaustive;
    }
  }
}

export function parseTooltipTime(label: string | number | undefined): number | null {
  if (typeof label === "number" && Number.isFinite(label)) {
    return label;
  }
  if (typeof label !== "string" || label.length === 0) {
    return null;
  }
  const parsed = Date.parse(label.includes("T") ? label : `${commodityDateKey(label)}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function tooltipRowsAtTime(
  series: CommodityChartSeries[],
  time: number
): CommodityTooltipRow[] {
  const rows: CommodityTooltipRow[] = [];
  for (const entry of series) {
    let match: CommodityChartPoint | undefined;
    for (const point of entry.points) {
      if (point.time <= time) {
        match = point;
        continue;
      }
      break;
    }
    if (!match) {
      continue;
    }
    rows.push({
      commodity: entry.commodity,
      label: entry.label,
      color: entry.color,
      native: match.native,
      unit: match.unit,
      date: match.date,
    });
  }
  return rows;
}

export function commoditySeriesLinePath(points: CommodityChartPoint[]): string {
  const first = points[0];
  if (!first) {
    return "";
  }

  const commands = [`M${first.time},${first.value}`];
  for (const point of points.slice(1)) {
    commands.push(`L${point.time},${point.value}`);
  }
  return commands.join("");
}

export function buildCommodityChartSeries(
  data: CommodityPrice[],
  selectedSeries: string[],
  scale: CommodityScale
): CommodityChartSeries[] {
  const selected = new Set(selectedSeries);
  const grouped = new Map<string, CommodityPrice[]>();

  for (const row of data) {
    if (!selected.has(row.commodity)) {
      continue;
    }
    const list = grouped.get(row.commodity) ?? [];
    list.push(row);
    grouped.set(row.commodity, list);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => commodityDisplayIndex(left) - commodityDisplayIndex(right))
    .flatMap(([commodity, rows]) => {
      const sorted = [...rows].sort((left, right) =>
        commodityDateKey(left.date).localeCompare(commodityDateKey(right.date))
      );
      const natives = sorted.map((row) => commodityChartValue(row));
      const indexed = indexToFirstValue(natives);
      const points: CommodityChartPoint[] = [];

      for (const [index, row] of sorted.entries()) {
        const native = natives[index];
        if (native == null) {
          continue;
        }
        const value = displaySeriesValue(scale, native, indexed[index] ?? null);
        if (value == null) {
          continue;
        }
        points.push({
          date: commodityDateKey(row.date),
          time: commodityTime(row.date),
          value,
          native,
          unit: formatCommodityNativeUnit(row.commodity, row.unit),
          commodity,
        });
      }

      if (points.length === 0) {
        return [];
      }

      return [
        {
          commodity,
          label: COMMODITY_LABELS[commodity] ?? commodity,
          color: COMMODITY_COLORS[commodity] ?? "#71717a",
          monthly: isMonthlyPublicCommodity(commodity),
          points,
        },
      ];
    });
}
