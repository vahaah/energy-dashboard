"use client";

import { useState } from "react";
import { ConstraintCostChart } from "@/components/constraints/constraint-cost-chart";
import { ConstraintVolumeChart } from "@/components/constraints/constraint-volume-chart";
import {
  measuredCostChart,
  measuredVolumeChart,
  type CostChartPoint,
  type MeasuredCostChartSeries,
  type MeasuredVolumeChartSeries,
  type VolumeChartPoint,
} from "@/lib/constraints/chart-series";
import { CONSTRAINTS_VOLUME_SOURCE, CONSTRAINTS_VOLUME_TITLE } from "@/lib/constraints/copy";

type Grain = "week" | "day";

export function ConstraintSeries({
  cost,
  volume,
}: {
  cost: MeasuredCostChartSeries | null;
  volume: MeasuredVolumeChartSeries | null;
}) {
  const [grain, setGrain] = useState<Grain>("week");
  const costSeries = cost ? (grain === "week" ? weeklyCost(cost) : cost) : null;
  const volumeSeries = volume ? (grain === "week" ? weeklyVolume(volume) : volume) : null;
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="inline-flex rounded-md border border-gray-alpha-400 bg-background-200" role="group" aria-label="Chart grain">
        <GrainButton pressed={grain === "week"} onClick={() => setGrain("week")}>
          Weekly
        </GrainButton>
        <GrainButton pressed={grain === "day"} onClick={() => setGrain("day")}>
          Daily
        </GrainButton>
      </div>
      {costSeries ? <ConstraintCostChart series={costSeries} /> : null}
      {volumeSeries ? (
        <div>
          <h3 className="text-heading-16 text-gray-1000">{CONSTRAINTS_VOLUME_TITLE}</h3>
          <p className="mt-2 mb-3 break-words text-copy-14 text-gray-900">{CONSTRAINTS_VOLUME_SOURCE}</p>
          <ConstraintVolumeChart series={volumeSeries} />
        </div>
      ) : null}
    </div>
  );
}

function GrainButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-8 min-h-11 items-center rounded-md px-3 text-label-13 sm:min-h-8 ${
        pressed ? "bg-background-100 text-gray-1000" : "text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function weekStart(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - delta);
  return date.toISOString().slice(0, 10);
}

function weeklyCost(series: MeasuredCostChartSeries): MeasuredCostChartSeries {
  return measuredCostChart({ kind: "measured", unit: "GBP", points: weeklyPoints(series.points) });
}

function weeklyVolume(series: MeasuredVolumeChartSeries): MeasuredVolumeChartSeries {
  return measuredVolumeChart({ kind: "measured", unit: "MWh", points: weeklyPoints(series.points) });
}

function weeklyPoints(points: readonly CostChartPoint[] | readonly VolumeChartPoint[]): CostChartPoint[] {
  const byWeek = new Map<string, CostChartPoint>();
  for (const point of points) {
    const key = weekStart(point.date);
    const current = byWeek.get(key) ?? {
      date: key,
      reducing_largest_loss: 0,
      increasing_system_inertia: 0,
      voltage: 0,
      thermal: 0,
    };
    current.reducing_largest_loss += point.reducing_largest_loss;
    current.increasing_system_inertia += point.increasing_system_inertia;
    current.voltage += point.voltage;
    current.thermal += point.thermal;
    byWeek.set(key, current);
  }
  return [...byWeek.values()].sort((left, right) => left.date.localeCompare(right.date));
}
