"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "@/components/charts/chart-legend";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import {
  chartAnimation,
  chartAxisLine,
  chartAxisTick,
  chartGrid,
  chartHeroLine,
  CHART_HEIGHT_HERO,
} from "@/lib/chart-theme";
import {
  BREAKDOWN_CATEGORIES,
  BREAKDOWN_CATEGORY_COLOR,
  BREAKDOWN_CATEGORY_LABEL,
} from "@/lib/constraints/categories";
import {
  measuredVolumeChart,
  type MeasuredVolumeChartSeries,
  type VolumeChartPoint,
} from "@/lib/constraints/chart-series";

function tickLabel(value: string): string {
  const [, month, day] = value.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = Number(month) - 1;
  return `${Number(day)} ${months[index] ?? month}`;
}

function megawattHours(value: number): string {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value)} MWh`;
}

function axisVolume(value: number, gigawattHours: boolean): string {
  if (!gigawattHours) {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 1000);
}

const SERIES_DASH = ["0", "6 4", "2 3", "10 4 2 4"] as const;

function VolumeTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ dataKey?: string | number; value?: number | string | null; color?: string }>;
}) {
  if (!active || payload == null || payload.length === 0 || label == null) {
    return null;
  }
  return (
    <ChartTooltipCard time={String(label)}>
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? "");
        const category = BREAKDOWN_CATEGORIES.find((item) => item === key);
        return (
          <ChartTooltipRow
            key={key}
            color={entry.color ?? "var(--gray-1000)"}
            label={category ? BREAKDOWN_CATEGORY_LABEL[category] : key}
            value={entry.value == null ? "—" : megawattHours(Number(entry.value))}
          />
        );
      })}
    </ChartTooltipCard>
  );
}

export function ConstraintVolumeChart({ series }: { series: MeasuredVolumeChartSeries }) {
  const checked = measuredVolumeChart(series);
  const peak = Math.max(
    0,
    ...checked.points.flatMap((point) => BREAKDOWN_CATEGORIES.map((category) => point[category])),
  );
  const gigawattHours = peak >= 1000;
  return (
    <div data-chart="constraint-volume" data-unit="MWh">
      <p className="mb-2 text-copy-14 text-gray-900">{gigawattHours ? "Volume, GWh" : "Volume, MWh"}</p>
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO} summary="Constraint volume, megawatt-hours.">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...checked.points]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="date" tick={chartAxisTick} tickFormatter={tickLabel} {...chartAxisLine} minTickGap={24} />
            <YAxis
              tick={chartAxisTick}
              {...chartAxisLine}
              width={56}
              tickFormatter={(value: number) => axisVolume(value, gigawattHours)}
            />
            <Tooltip content={<VolumeTooltip />} {...chartAnimation} />
            {BREAKDOWN_CATEGORIES.map((category, index) => (
              <Line
                key={category}
                dataKey={category satisfies keyof VolumeChartPoint}
                name={BREAKDOWN_CATEGORY_LABEL[category]}
                stroke={BREAKDOWN_CATEGORY_COLOR[category]}
                strokeDasharray={SERIES_DASH[index]}
                {...chartHeroLine}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      <ChartLegend
        items={BREAKDOWN_CATEGORIES.map((category, index) => ({
          id: category,
          label: BREAKDOWN_CATEGORY_LABEL[category],
          color: BREAKDOWN_CATEGORY_COLOR[category],
          dash: SERIES_DASH[index],
        }))}
      />
    </div>
  );
}
