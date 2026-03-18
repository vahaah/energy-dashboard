"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Generation5min, TimeRange } from "@/lib/types";
import { INTERCONNECTOR_COLORS, INTERCONNECTOR_LABELS } from "@/lib/colors";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { isInterconnectorFuel, normalizeFuelType } from "@/lib/dashboard-model";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";

interface Props {
  data: Generation5min[];
  range: TimeRange;
}

export function InterconnectorFlowsChart({ data, range }: Props) {
  const byTimestamp = new Map<string, Record<string, number | string>>();
  const connectorAbs = new Map<string, number>();

  for (const row of data) {
    if (!isInterconnectorFuel(row.fuel_type)) continue;

    const interconnector = normalizeFuelType(row.fuel_type);
    if (!byTimestamp.has(row.timestamp)) {
      byTimestamp.set(row.timestamp, { time: row.timestamp, net: 0 });
    }

    const entry = byTimestamp.get(row.timestamp)!;
    entry[interconnector] = Number(entry[interconnector] ?? 0) + row.generation_mw / 1000;
    entry.net = Number(entry.net ?? 0) + row.generation_mw / 1000;
    connectorAbs.set(
      interconnector,
      (connectorAbs.get(interconnector) ?? 0) + Math.abs(row.generation_mw)
    );
  }

  const connectors = Array.from(connectorAbs.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([connector]) => connector);

  const chartData = Array.from(byTimestamp.values()).sort(
    (a, b) =>
      new Date(a.time as string).getTime() - new Date(b.time as string).getTime()
  );

  return (
    <ResponsiveChartFrame className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            tickFormatter={(value) => formatChartTick(String(value), range)}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            tickFormatter={(value) => `${Number(value).toFixed(1)}`}
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
            labelFormatter={(value) => formatChartTooltip(value as string, range)}
            formatter={(value, name) => [
              `${Number(value).toFixed(2)} GW`,
              INTERCONNECTOR_LABELS[String(name)] ?? name,
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
          <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
          {connectors.map((connector) => (
            <Line
              key={connector}
              type="monotone"
              dataKey={connector}
              stroke={INTERCONNECTOR_COLORS[connector] ?? "#94a3b8"}
              strokeWidth={2}
              dot={false}
              name={INTERCONNECTOR_LABELS[connector] ?? connector}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
