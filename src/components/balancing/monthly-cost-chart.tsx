"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { LineSample, Swatch } from "@/components/balancing/chart-marks";
import { monthTicks, poundChartAxis, tariffChartAxis } from "@/lib/balancing/axis";
import { BALANCING_CATEGORY_COLOR, BALANCING_CONSTRAINTS_FILL } from "@/lib/balancing/categories";
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
    <ChartTooltipCard time={`${formatMonth(point.month)}${point.provisional ? " · Incomplete" : ""}`}>
      <ChartTooltipRow
        color={BALANCING_CATEGORY_COLOR.constraints}
        label="Constraints"
        value={formatPounds(point.constraints ?? 0, 1)}
      />
      <ChartTooltipRow
        color={BALANCING_CATEGORY_COLOR.other}
        label="Other categories"
        value={formatPounds(point.other ?? 0, 1)}
      />
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
  const costs: number[] = [0];
  const tariffs: number[] = [0];
  for (const point of points) {
    if (point.gap) {
      continue;
    }
    costs.push((point.constraints ?? 0) + (point.other ?? 0), point.total ?? 0);
    if (point.tariff_gbp_per_mwh != null) {
      tariffs.push(point.tariff_gbp_per_mwh);
    }
  }
  const costAxis = poundChartAxis(costs);
  const tariffAxis = tariffChartAxis(tariffs);
  const ticks = monthTicks(points.map((point) => point.month));
  return (
    <div className="relative min-w-0">
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              ticks={ticks}
              interval={ticks ? 0 : "preserveStartEnd"}
              minTickGap={ticks ? 0 : 24}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <YAxis
              yAxisId="cost"
              domain={costAxis.domain}
              ticks={costAxis.ticks}
              tickFormatter={costAxis.format}
              width={64}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <YAxis
              yAxisId="tariff"
              orientation="right"
              domain={tariffAxis.domain}
              ticks={tariffAxis.ticks}
              tickFormatter={tariffAxis.format}
              width={48}
              tick={chartAxisTick}
              {...chartAxisLine}
              label={{
                value: "£/MWh",
                angle: 90,
                position: "insideRight",
                offset: -4,
                style: { fill: "var(--gray-900)", fontSize: 12 },
              }}
            />
            <Tooltip content={<MonthlyTooltip />} wrapperStyle={{ zIndex: 30 }} />
            <Bar
              yAxisId="cost"
              dataKey="constraints"
              stackId="month"
              fill={BALANCING_CONSTRAINTS_FILL}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="cost"
              dataKey="other"
              stackId="month"
              fill={BALANCING_CATEGORY_COLOR.other}
              isAnimationActive={false}
            />
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
          <Swatch color={BALANCING_CATEGORY_COLOR.constraints} hatch />
          Constraints
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Swatch color={BALANCING_CATEGORY_COLOR.other} />
          Other categories
        </li>
        <li className="inline-flex items-center gap-1.5">
          <LineSample dashed />
          BSUoS tariff, £/MWh
        </li>
      </ul>
    </div>
  );
}
