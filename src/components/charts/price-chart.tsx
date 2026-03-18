"use client";

import {
  LineChart,
  Line,
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

export function ElectricityPriceChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    price: Math.round(d.price_gbp_mwh * 100) / 100,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
              value: "£/MWh",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#71717a" },
            }}
          />
          <Tooltip
            labelFormatter={(t) => format(new Date(t as string), "dd MMM HH:mm")}
            formatter={(value) => [`£${Number(value).toFixed(2)}`, "System Price"]}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            name="System Price"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
