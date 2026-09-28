"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Generation5min, TimeRange } from "@/lib/types";
import { fuelColor, fuelLabel } from "@/lib/colors";
import {
  formatChartTick,
  formatChartTooltip,
} from "@/lib/chart-formatting";
import {
  buildGenerationStackSeries,
  GENERATION_STACK_FUELS,
} from "@/lib/dashboard-model";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";

interface Props {
  data: Generation5min[];
  range: TimeRange;
}

export function GenerationStackChart({ data, range }: Props) {
  const chartData = buildGenerationStackSeries(data, range);

  return (
    <ResponsiveChartFrame className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(t) => formatChartTick(Number(t), range)}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <Tooltip
            labelFormatter={(t) => formatChartTooltip(t as number, range)}
            formatter={(value, name) => [
              `${(typeof value === "number" ? value : 0).toFixed(1)}%`,
              fuelLabel(String(name)),
            ]}
            wrapperStyle={{ zIndex: 320 }}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {GENERATION_STACK_FUELS.map((fuel) => (
            <Area
              key={fuel}
              type="monotone"
              dataKey={fuel}
              stackId="generation"
              stroke={fuelColor(fuel)}
              fill={fuelColor(fuel)}
              fillOpacity={0.8}
              name={fuelLabel(fuel)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
