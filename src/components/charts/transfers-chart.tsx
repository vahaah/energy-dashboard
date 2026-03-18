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
import type { Generation5min } from "@/lib/types";

interface Props {
  data: Generation5min[];
}

export function TransfersChart({ data }: Props) {
  // Filter to interconnectors, group by timestamp, sum for net transfer
  const interconnectors = data.filter((d) => d.fuel_type.startsWith("INT"));

  const byTimestamp = new Map<string, number>();
  for (const row of interconnectors) {
    byTimestamp.set(
      row.timestamp,
      (byTimestamp.get(row.timestamp) ?? 0) + row.generation_mw
    );
  }

  const chartData = Array.from(byTimestamp.entries())
    .map(([timestamp, net_mw]) => ({
      time: timestamp,
      ts: new Date(timestamp).getTime(),
      net_gw: net_mw / 1000,
    }))
    .sort((a, b) => a.ts - b.ts);

  if (chartData.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
        No transfer data available
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            tickFormatter={(t) => format(new Date(t), "HH:mm")}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
            label={{
              value: "GW",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#71717a" },
            }}
          />
          <Tooltip
            labelFormatter={(t) => format(new Date(t as string), "dd MMM HH:mm")}
            formatter={(value) => {
              const v = Number(value) || 0;
              return [
                `${v >= 0 ? "+" : ""}${v.toFixed(2)} GW`,
                v >= 0 ? "Net Import" : "Net Export",
              ];
            }}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <ReferenceLine y={0} stroke="#71717a" strokeDasharray="3 3" />
          <defs>
            <linearGradient id="transferGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#22c55e" stopOpacity={0} />
              <stop offset="50%" stopColor="#ef4444" stopOpacity={0} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="net_gw"
            stroke="#22c55e"
            fill="url(#transferGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
