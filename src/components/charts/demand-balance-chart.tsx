"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { buildDemandBalanceSeries } from "@/lib/dashboard-model";

interface Props {
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
  range: TimeRange;
}

export function DemandBalanceChart({ snapshots, generation, range }: Props) {
  const chartData = buildDemandBalanceSeries(snapshots, generation, range);

  return (
    <ResponsiveChartFrame className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            tickFormatter={(value) => formatChartTick(String(value), range)}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
            label={{
              value: "MW",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#71717a" },
            }}
          />
          <Tooltip
            labelFormatter={(value) => formatChartTooltip(value as string, range)}
            formatter={(value, name) => {
              const labelMap: Record<string, string> = {
                demandMw: "Demand",
                domesticGenerationMw: "Domestic generation",
              };

              return [
                `${Math.round(Number(value)).toLocaleString()} MW`,
                labelMap[String(name)] ?? name,
              ];
            }}
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
          <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="demandMw"
            stroke="#f8fafc"
            strokeWidth={2}
            dot={false}
            name="Demand"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="domesticGenerationMw"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            name="Domestic generation"
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
