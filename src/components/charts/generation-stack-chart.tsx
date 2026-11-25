"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { chartAnimation, chartAxisLine, chartAxisTick, chartGrid, chartStackedArea, CHART_HEIGHT_HERO } from "@/lib/chart-theme";
import { fuelColor, fuelLabel } from "@/lib/colors";
import { buildGenerationStackSeries, GENERATION_STACK_FUELS } from "@/lib/dashboard-model";
import type { Generation5min, TimeRange } from "@/lib/types";

type StackTooltipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
};

export function GenerationStackTooltip({
  active,
  label,
  payload,
  range,
}: {
  active?: boolean;
  label?: string | number;
  payload?: StackTooltipEntry[];
  range: TimeRange;
}) {
  if (!active || payload == null || payload.length === 0 || label == null) {
    return null;
  }

  const rows = [...payload]
    .filter((entry) => Number(entry.value) > 0)
    .sort((left, right) => Number(right.value) - Number(left.value));

  return (
    <ChartTooltipCard time={formatChartTooltip(Number(label), range)}>
      {rows.map((entry) => (
        <ChartTooltipRow
          key={String(entry.dataKey)}
          color={fuelColor(String(entry.dataKey))}
          label={fuelLabel(String(entry.name ?? entry.dataKey))}
          value={`${Number(entry.value).toFixed(1)}%`}
        />
      ))}
    </ChartTooltipCard>
  );
}

interface Props {
  data: Generation5min[];
  range: TimeRange;
}

export function GenerationStackChart({ data, range }: Props) {
  const chartData = buildGenerationStackSeries(data, range);

  return (
    <ResponsiveChartFrame className={CHART_HEIGHT_HERO} summary="Generation mix over time, share of megawatts.">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid {...chartGrid} />
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(t) => formatChartTick(Number(t), range)}
            tick={chartAxisTick}
            {...chartAxisLine}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
            tick={chartAxisTick}
            {...chartAxisLine}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "var(--gray-alpha-400)", strokeWidth: 1 }}
            content={<GenerationStackTooltip range={range} />}
            wrapperStyle={{ zIndex: 320 }}
          />
          {GENERATION_STACK_FUELS.map((fuel) => (
            <Area
              key={fuel}
              type="monotone"
              dataKey={fuel}
              stackId="generation"
              fill={fuelColor(fuel)}
              name={fuelLabel(fuel)}
              {...chartStackedArea}
              {...chartAnimation}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
