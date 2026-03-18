"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { format } from "date-fns";
import type { EnergySnapshot } from "@/lib/types";
import { FUEL_COLORS, FUEL_LABELS } from "@/lib/colors";

interface Props {
  data: EnergySnapshot[];
}

const FUELS = [
  "embedded_wind", "embedded_solar",
  "wind", "solar", "nuclear", "hydro", "biomass", "gas", "coal", "imports", "other",
] as const;

const EXTENDED_LABELS: Record<string, string> = {
  ...FUEL_LABELS,
  embedded_solar: "Embedded Solar",
  embedded_wind: "Embedded Wind",
};

const EXTENDED_COLORS: Record<string, string> = {
  ...FUEL_COLORS,
  embedded_solar: "#fbbf24",
  embedded_wind: "#22d3ee",
};

export function GenerationStackChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    wind: d.gen_wind_pct,
    solar: d.gen_solar_pct,
    nuclear: d.gen_nuclear_pct,
    hydro: d.gen_hydro_pct,
    biomass: d.gen_biomass_pct,
    gas: d.gen_gas_pct,
    coal: d.gen_coal_pct,
    imports: d.gen_imports_pct,
    other: d.gen_other_pct,
    embedded_solar: 0,
    embedded_wind: 0,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }} stackOffset="expand">
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            tickFormatter={(t) => format(new Date(t), "HH:mm")}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <Tooltip
            labelFormatter={(t) => format(new Date(t as string), "dd MMM HH:mm")}
            formatter={(value, name) => [
              `${(typeof value === "number" ? value : 0).toFixed(1)}%`,
              EXTENDED_LABELS[String(name)] ?? name,
            ]}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {FUELS.map((fuel) => (
            <Area
              key={fuel}
              type="monotone"
              dataKey={fuel}
              stackId="1"
              stroke={EXTENDED_COLORS[fuel] ?? FUEL_COLORS[fuel]}
              fill={EXTENDED_COLORS[fuel] ?? FUEL_COLORS[fuel]}
              fillOpacity={0.8}
              name={EXTENDED_LABELS[fuel] ?? fuel}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
