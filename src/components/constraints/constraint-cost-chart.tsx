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
import { measuredCostChart, type CostChartPoint, type MeasuredCostChartSeries } from "@/lib/constraints/chart-series";

function tickLabel(value: string): string {
  const [, month, day] = value.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = Number(month) - 1;
  return `${Number(day)} ${months[index] ?? month}`;
}

function pounds(value: number): string {
  return `£${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value)}`;
}

function axisPounds(value: number, millions: boolean): string {
  if (!millions) {
    return pounds(value);
  }
  const scaled = value / 1_000_000;
  const digits = Math.abs(scaled) >= 10 ? 0 : 1;
  return `£${new Intl.NumberFormat("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(scaled)}m`;
}

const SERIES_DASH = ["0", "6 4", "2 3", "10 4 2 4"] as const;

function CostTooltip({
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
            value={entry.value == null ? "—" : pounds(Number(entry.value))}
          />
        );
      })}
    </ChartTooltipCard>
  );
}

export function ConstraintCostChart({ series }: { series: MeasuredCostChartSeries }) {
  const checked = measuredCostChart(series);
  const peak = Math.max(
    0,
    ...checked.points.flatMap((point) => BREAKDOWN_CATEGORIES.map((category) => point[category])),
  );
  const millions = peak >= 1_000_000;
  return (
    <div data-chart="constraint-cost" data-unit="GBP">
      <p className="mb-2 text-copy-14 text-gray-900">{millions ? "Cost, £ million" : "Cost, £"}</p>
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...checked.points]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="date" tick={chartAxisTick} tickFormatter={tickLabel} {...chartAxisLine} minTickGap={24} />
            <YAxis
              tick={chartAxisTick}
              {...chartAxisLine}
              width={64}
              tickFormatter={(value: number) => axisPounds(value, millions)}
            />
            <Tooltip content={<CostTooltip />} {...chartAnimation} />
            {BREAKDOWN_CATEGORIES.map((category, index) => (
              <Line
                key={category}
                dataKey={category satisfies keyof CostChartPoint}
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
          dashed: index > 0,
        }))}
      />
    </div>
  );
}
