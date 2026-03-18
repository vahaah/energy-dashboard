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
import { format } from "date-fns";
import type { EnergySnapshot } from "@/lib/types";

interface Props {
  data: EnergySnapshot[];
}

export function DemandChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    demand: Math.round(d.demand_mw),
  }));

  return (
    <div className="h-64">
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
            tickFormatter={(t) => format(new Date(t), "HH:mm")}
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
            labelFormatter={(t) => format(new Date(t as string), "dd MMM HH:mm")}
            formatter={(value) => [`${Number(value).toLocaleString()} MW`, "Demand"]}
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
    </div>
  );
}
