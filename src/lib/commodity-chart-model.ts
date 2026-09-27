import { COMMODITY_COLORS, COMMODITY_LABELS, commodityDisplayIndex } from "@/lib/colors";
import { isMonthlyPublicCommodity, normalizeCommodityUnit } from "@/lib/commodity-series";
import {
  commodityChartValue,
  GB_GAS_SAP_COMMODITY,
} from "@/lib/gb-gas-sap";
import type { CommodityPrice } from "@/lib/types";

export type CommodityScale = "index" | "native";

export type CommodityChartPoint = {
  date: string;
  time: number;
  value: number;
  native: number;
  unit: string;
  commodity: string;
};

export type CommodityChartSeries = {
  commodity: string;
  label: string;
  color: string;
  monthly: boolean;
  points: CommodityChartPoint[];
};

export const COMMODITY_SCALE_OPTIONS = [
  { value: "index", label: "Indexed" },
  { value: "native", label: "Native units" },
] as const;

export function commodityDateKey(date: string): string {
  return date.slice(0, 10);
}

export function commodityTime(date: string): number {
  return Date.parse(`${commodityDateKey(date)}T00:00:00.000Z`);
}

export function indexToFirstValue(values: Array<number | null>): Array<number | null> {
  const base = values.find((value) => value != null && Number.isFinite(value) && value !== 0);
  if (base == null) {
    return values.map(() => null);
  }

  return values.map((value) => {
    if (value == null || !Number.isFinite(value)) {
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
      return "Indexed, start of range = 100";
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
      return "Index";
    case "native":
      return "Native units";
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
