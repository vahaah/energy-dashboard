"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  return (
    <div data-chart="constraint-volume" data-unit="MWh">
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...checked.points]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="date" tick={chartAxisTick} tickFormatter={tickLabel} {...chartAxisLine} minTickGap={24} />
            <YAxis
              tick={chartAxisTick}
              {...chartAxisLine}
              width={72}
              tickFormatter={(value: number) => megawattHours(value)}
            />
            <Tooltip content={<VolumeTooltip />} {...chartAnimation} />
            {BREAKDOWN_CATEGORIES.map((category) => (
              <Line
                key={category}
                dataKey={category satisfies keyof VolumeChartPoint}
                name={BREAKDOWN_CATEGORY_LABEL[category]}
                stroke={BREAKDOWN_CATEGORY_COLOR[category]}
                {...chartHeroLine}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
    </div>
  );
}
