"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { format } from "date-fns";
import type { CommodityPrice } from "@/lib/types";
import { COMMODITY_COLORS, COMMODITY_LABELS } from "@/lib/colors";

interface Props {
  data: CommodityPrice[];
}

export function CommodityChart({ data }: Props) {
  // Pivot: one row per date with columns per commodity
  const byDate = new Map<string, Record<string, number | string>>();
  for (const row of data) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, { date: row.date });
    }
    byDate.get(row.date)![row.commodity] = row.price;
  }
  const chartData = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
  );

  const commodities = [...new Set(data.map((d) => d.commodity))];

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => format(new Date(d), "dd MMM")}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
            label={{
              value: "USD",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#71717a" },
            }}
          />
          <Tooltip
            labelFormatter={(d) => format(new Date(d as string), "dd MMM yyyy")}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {commodities.map((c) => (
            <Line
              key={c}
              type="monotone"
              dataKey={c}
              stroke={COMMODITY_COLORS[c] ?? "#71717a"}
              strokeWidth={2}
              dot={false}
              name={COMMODITY_LABELS[c] ?? c}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
