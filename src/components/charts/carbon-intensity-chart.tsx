"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import type { EnergySnapshot } from "@/lib/types";

interface Props {
  data: EnergySnapshot[];
}

export function CarbonIntensityChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    actual: Math.round(d.carbon_intensity),
    forecast: Math.round(d.carbon_forecast),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="carbonGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            tickFormatter={(t) => format(new Date(t), "HH:mm")}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
            label={{ value: "gCO₂/kWh", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#71717a" } }}
          />
          <Tooltip
            labelFormatter={(t) => format(new Date(t as string), "dd MMM HH:mm")}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <ReferenceLine y={200} stroke="#f97316" strokeDasharray="4 4" label={{ value: "High", fill: "#f97316", fontSize: 10 }} />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#carbonGrad)"
            name="Actual"
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="#71717a"
            strokeWidth={1}
            strokeDasharray="4 4"
            fill="transparent"
            name="Forecast"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
