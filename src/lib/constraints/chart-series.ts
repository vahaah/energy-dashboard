import type { SeriesKind } from "@/lib/types";
import type { BreakdownCategory } from "@/lib/constraints/categories";

export type CostChartPoint = {
  date: string;
  reducing_largest_loss: number;
  increasing_system_inertia: number;
  voltage: number;
  thermal: number;
};

export type VolumeChartPoint = {
  date: string;
  reducing_largest_loss: number;
  increasing_system_inertia: number;
  voltage: number;
  thermal: number;
};

export type MeasuredCostChartSeries = {
  kind: "measured";
  unit: "GBP";
  points: readonly CostChartPoint[];
};

export type MeasuredVolumeChartSeries = {
  kind: "measured";
  unit: "MWh";
  points: readonly VolumeChartPoint[];
};

export function assertMeasuredKind(series: { kind: SeriesKind }): asserts series is { kind: "measured" } {
  if (series.kind !== "measured") {
    throw new Error("A forecast series cannot render on a measured chart");
  }
}

export function assertSingleAxis(units: readonly string[]): string {
  const distinct = new Set(units);
  if (distinct.size !== 1) {
    throw new Error("£ and MWh never share an axis");
  }
  const unit = [...distinct][0];
  if (unit !== "GBP" && unit !== "MWh") {
    throw new Error("£ and MWh never share an axis");
  }
  return unit;
}

export function measuredCostChart(series: MeasuredCostChartSeries): MeasuredCostChartSeries {
  assertMeasuredKind(series);
  if (assertSingleAxis([series.unit]) !== "GBP") {
    throw new Error("£ and MWh never share an axis");
  }
  return series;
}

export function measuredVolumeChart(series: MeasuredVolumeChartSeries): MeasuredVolumeChartSeries {
  assertMeasuredKind(series);
  if (assertSingleAxis([series.unit]) !== "MWh") {
    throw new Error("£ and MWh never share an axis");
  }
  return series;
}

export function costValue(point: CostChartPoint, category: BreakdownCategory): number {
  switch (category) {
    case "reducing_largest_loss":
      return point.reducing_largest_loss;
    case "increasing_system_inertia":
      return point.increasing_system_inertia;
    case "voltage":
      return point.voltage;
    case "thermal":
      return point.thermal;
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}
