"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { ConstraintsHatch, LineSample, Swatch } from "@/components/balancing/chart-marks";
import {
  BALANCING_CATEGORIES,
  BALANCING_CATEGORY_COLOR,
  BALANCING_CATEGORY_LABEL,
  BALANCING_CONSTRAINTS_FILL,
  type BalancingCategory,
} from "@/lib/balancing/categories";
import { poundChartAxis } from "@/lib/balancing/axis";
import { formatPounds } from "@/lib/balancing/money";
import type { DailyChartPoint } from "@/lib/balancing/aggregate";
import { chartAnimation, chartAxisLine, chartAxisTick, chartGrid, chartLine } from "@/lib/chart-theme";

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function DailyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DailyChartPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.gap) {
    return null;
  }
  return (
    <ChartTooltipCard time={`${formatDay(point.date)}${point.provisional ? " · Incomplete" : ""}`}>
      {BALANCING_CATEGORIES.map((category) => (
        <ChartTooltipRow
          key={category}
          color={BALANCING_CATEGORY_COLOR[category]}
          label={BALANCING_CATEGORY_LABEL[category]}
          value={formatPounds(point[category] ?? 0, 1)}
        />
      ))}
      <ChartTooltipRow color="var(--gray-1000)" label="Total" value={formatPounds(point.total ?? 0, 1)} />
    </ChartTooltipCard>
  );
}

function extent(points: readonly DailyChartPoint[]): number[] {
  const values: number[] = [0];
  for (const point of points) {
    if (point.gap) {
      continue;
    }
    let positive = 0;
    let negative = 0;
    for (const category of BALANCING_CATEGORIES) {
      const value = point[category] ?? 0;
      if (value >= 0) {
        positive += value;
      } else {
        negative += value;
      }
    }
    values.push(positive, negative, point.total ?? 0);
  }
  return values;
}

function DailyPlot({ points, summary }: { points: DailyChartPoint[]; summary: boolean }) {
  const axis = poundChartAxis(extent(points));
  const categories = summary ? (["constraints"] as const) : BALANCING_CATEGORIES;
  return (
    <ResponsiveChartFrame className={summary ? "h-[240px]" : "h-[280px]"}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={28} tick={chartAxisTick} {...chartAxisLine} />
          <YAxis
            domain={axis.domain}
            ticks={axis.ticks}
            tickFormatter={axis.format}
            width={64}
            tick={chartAxisTick}
            {...chartAxisLine}
          />
          <Tooltip content={<DailyTooltip />} wrapperStyle={{ zIndex: 30 }} />
          {categories.map((category) => (
            <Bar
              key={category}
              dataKey={category}
              stackId="cost"
              fill={category === "constraints" ? BALANCING_CONSTRAINTS_FILL : BALANCING_CATEGORY_COLOR[category]}
              name={BALANCING_CATEGORY_LABEL[category]}
              isAnimationActive={false}
            />
          ))}
          <Line dataKey="total" stroke="var(--gray-1000)" name="Total" {...chartLine} {...chartAnimation} />
        </ComposedChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}

export function DailyCostChart({ points }: { points: DailyChartPoint[] }) {
  return (
    <div className="relative min-w-0">
      <ConstraintsHatch />
      <div className="sm:hidden">
        <DailyPlot points={points} summary />
      </div>
      <div className="hidden sm:block">
        <DailyPlot points={points} summary={false} />
      </div>
      <CategoryLegend />
    </div>
  );
}

export function CategoryLegend() {
  const items: Array<{ key: string; label: string; color: string; hatch: boolean }> = BALANCING_CATEGORIES.map(
    (category: BalancingCategory) => ({
      key: category,
      label: BALANCING_CATEGORY_LABEL[category],
      color: BALANCING_CATEGORY_COLOR[category],
      hatch: category === "constraints",
    }),
  );
  return (
    <ul className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1">
      {items.map((item) => (
        <li key={item.key} className="inline-flex min-w-0 items-center gap-1.5 text-label-13 text-gray-900">
          <Swatch color={item.color} hatch={item.hatch} />
          <span className="break-words">{item.label}</span>
        </li>
      ))}
      <li className="inline-flex min-w-0 items-center gap-1.5 text-label-13 text-gray-900">
        <LineSample />
        <span>Total</span>
      </li>
    </ul>
  );
}
