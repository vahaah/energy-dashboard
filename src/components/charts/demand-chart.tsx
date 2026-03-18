"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { EnergySnapshot, TimeRange } from "@/lib/types";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
}

export function DemandChart({ data, range }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    demand: Math.round(d.demand_mw),
  }));

  return (
    <ResponsiveChartFrame className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            tickFormatter={(t) => formatChartTick(String(t), range)}
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
            labelFormatter={(t) => formatChartTooltip(t as string, range)}
            formatter={(value) => [`${Number(value).toLocaleString()} MW`, "Demand"]}
            wrapperStyle={{ zIndex: 320 }}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="demand"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#demandGrad)"
            name="Demand"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
