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
import { FUEL_COLORS, FUEL_LABELS } from "@/lib/colors";
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

const EXTENDED_LABELS: Record<string, string> = {
  ...FUEL_LABELS,
  embedded_solar: "Embedded Solar",
  embedded_wind: "Embedded Wind",
};

const EXTENDED_COLORS: Record<string, string> = {
  ...FUEL_COLORS,
  embedded_solar: "#fbbf24",
  embedded_wind: "#22d3ee",
};

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
              EXTENDED_LABELS[String(name)] ?? name,
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
              stroke={EXTENDED_COLORS[fuel] ?? FUEL_COLORS[fuel]}
              fill={EXTENDED_COLORS[fuel] ?? FUEL_COLORS[fuel]}
              fillOpacity={0.8}
              name={EXTENDED_LABELS[fuel] ?? fuel}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
