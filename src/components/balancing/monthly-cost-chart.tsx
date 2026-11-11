"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import type { MonthlyChartPoint } from "@/lib/balancing/aggregate";
import { formatPounds, formatTariff } from "@/lib/balancing/money";
import { chartAxisLine, chartAxisTick, chartGrid, CHART_HEIGHT_HERO } from "@/lib/chart-theme";

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) {
    return month;
  }
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );
}

function MonthlyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MonthlyChartPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.gap) {
    return null;
  }
  return (
    <ChartTooltipCard time={`${formatMonth(point.month)}${point.provisional ? " · Provisional" : ""}`}>
      <ChartTooltipRow color="var(--chart-wind)" label="Constraints" value={formatPounds(point.constraints ?? 0, 1)} />
      <ChartTooltipRow color="var(--chart-gas)" label="Everything else" value={formatPounds(point.other ?? 0, 1)} />
      <ChartTooltipRow color="var(--gray-1000)" label="Total" value={formatPounds(point.total ?? 0, 1)} />
      <ChartTooltipRow
        color="var(--gray-1000)"
        label="BSUoS tariff"
        value={point.tariff_gbp_per_mwh == null ? "—" : formatTariff(point.tariff_gbp_per_mwh)}
      />
    </ChartTooltipCard>
  );
}

export function MonthlyCostChart({ points }: { points: MonthlyChartPoint[] }) {
  return (
    <div className="min-w-0">
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="month" tickFormatter={formatMonth} minTickGap={24} tick={chartAxisTick} {...chartAxisLine} />
            <YAxis
              yAxisId="cost"
              tickFormatter={(value: number) => formatPounds(value, 0)}
              width={64}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <YAxis
              yAxisId="tariff"
              orientation="right"
              tickFormatter={(value: number) => `£${Math.round(value)}`}
              width={36}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <Tooltip content={<MonthlyTooltip />} wrapperStyle={{ zIndex: 30 }} />
            <Bar yAxisId="cost" dataKey="constraints" stackId="month" fill="var(--chart-wind)" isAnimationActive={false} />
            <Bar yAxisId="cost" dataKey="other" stackId="month" fill="var(--chart-gas)" isAnimationActive={false} />
            <Line
              yAxisId="tariff"
              dataKey="tariff_gbp_per_mwh"
              stroke="var(--gray-1000)"
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      <ul className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-label-13 text-gray-900">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-wind)]" aria-hidden="true" />
          Constraints
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-gas)]" aria-hidden="true" />
          Everything else
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gray-1000" aria-hidden="true" />
          BSUoS tariff, £/MWh
        </li>
      </ul>
    </div>
  );
}
