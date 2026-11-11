"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import {
  BALANCING_CATEGORIES,
  BALANCING_CATEGORY_COLOR,
  BALANCING_CATEGORY_LABEL,
  type BalancingCategory,
} from "@/lib/balancing/categories";
import { formatPounds } from "@/lib/balancing/money";
import type { DailyChartPoint } from "@/lib/balancing/aggregate";
import { chartAnimation, chartAxisLine, chartAxisTick, chartGrid, chartLine, CHART_HEIGHT_HERO } from "@/lib/chart-theme";

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
    <ChartTooltipCard time={`${formatDay(point.date)}${point.provisional ? " · Provisional" : ""}`}>
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

export function DailyCostChart({ points }: { points: DailyChartPoint[] }) {
  return (
    <div className="min-w-0">
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={28} tick={chartAxisTick} {...chartAxisLine} />
            <YAxis
              tickFormatter={(value: number) => formatPounds(value, 0)}
              width={64}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <Tooltip content={<DailyTooltip />} wrapperStyle={{ zIndex: 30 }} />
            {BALANCING_CATEGORIES.map((category) => (
              <Bar
                key={category}
                dataKey={category}
                stackId="cost"
                fill={BALANCING_CATEGORY_COLOR[category]}
                name={BALANCING_CATEGORY_LABEL[category]}
                isAnimationActive={false}
              />
            ))}
            <Line dataKey="total" stroke="var(--gray-1000)" name="Total" {...chartLine} {...chartAnimation} />
          </ComposedChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      <CategoryLegend />
    </div>
  );
}

export function CategoryLegend() {
  const items: Array<{ key: string; label: string; color: string }> = [
    ...BALANCING_CATEGORIES.map((category: BalancingCategory) => ({
      key: category,
      label: BALANCING_CATEGORY_LABEL[category],
      color: BALANCING_CATEGORY_COLOR[category],
    })),
    { key: "total", label: "Total", color: "var(--gray-1000)" },
  ];
  return (
    <ul className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1">
      {items.map((item) => (
        <li key={item.key} className="inline-flex min-w-0 items-center gap-1.5 text-label-13 text-gray-900">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span className="break-words">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
