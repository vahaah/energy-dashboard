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
import type { EnergySnapshot, TimeRange } from "@/lib/types";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
}

export function ElectricityPriceChart({ data, range }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    price: Math.round(d.price_gbp_mwh * 100) / 100,
  }));

  return (
    <ResponsiveChartFrame className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
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
              value: "£/MWh",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#71717a" },
            }}
          />
          <Tooltip
            labelFormatter={(t) => formatChartTooltip(t as string, range)}
            formatter={(value) => [`£${Number(value).toFixed(2)}`, "System Price"]}
            wrapperStyle={{ zIndex: 320 }}
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
    </ResponsiveChartFrame>
  );
}
