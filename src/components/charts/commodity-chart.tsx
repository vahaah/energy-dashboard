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
import type { CommodityPrice, CommodityRange } from "@/lib/types";
import { COMMODITY_COLORS, COMMODITY_LABELS } from "@/lib/colors";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";

interface Props {
  data: CommodityPrice[];
  range: CommodityRange;
  selectedSeries: string[];
}

export function CommodityChart({ data, range, selectedSeries }: Props) {
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

  const commodities = [...new Set(data.map((d) => d.commodity))].filter((commodity) =>
    selectedSeries.includes(commodity)
  );

  // Count data points per commodity to show dots for sparse series
  const countByCommodity = new Map<string, number>();
  for (const row of data) {
    countByCommodity.set(row.commodity, (countByCommodity.get(row.commodity) ?? 0) + 1);
  }

  return (
    <ResponsiveChartFrame className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatChartTick(String(d), range)}
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
            labelFormatter={(d) => formatChartTooltip(d as string, range)}
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
          {commodities.map((c) => {
            const count = countByCommodity.get(c) ?? 0;
            return (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                stroke={COMMODITY_COLORS[c] ?? "#71717a"}
                strokeWidth={2}
                dot={count <= 5 ? { r: 3 } : false}
                name={COMMODITY_LABELS[c] ?? c}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
