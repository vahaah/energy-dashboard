"use client";

import {
  Area,
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
import type { EnergySnapshot, TimeRange } from "@/lib/types";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
}

export function DemandBalanceChart({ data, range }: Props) {
  const chartData = data.map((snapshot) => {
    const domesticParts = [
      snapshot.gen_gas_mw,
      snapshot.gen_coal_mw,
      snapshot.gen_nuclear_mw,
      snapshot.gen_wind_mw,
      snapshot.gen_solar_mw,
      snapshot.gen_hydro_mw,
      snapshot.gen_biomass_mw,
      snapshot.gen_other_mw,
    ];
    const present = domesticParts.filter((value): value is number => value != null);
    const domesticGenerationMw = present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0);
    const demandMw = snapshot.demand_mw;
    const netImportsMw =
      demandMw == null || domesticGenerationMw == null ? null : demandMw - domesticGenerationMw;

    return {
      time: snapshot.timestamp,
      demandMw,
      domesticGenerationMw,
      netImportsMw,
    };
  });

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
                netImportsMw: "Net imports",
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
          <Area
            type="monotone"
            dataKey="netImportsMw"
            fill="#10b981"
            fillOpacity={0.18}
            stroke="#10b981"
            strokeWidth={2}
            name="Net imports"
            connectNulls={false}
          />
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
