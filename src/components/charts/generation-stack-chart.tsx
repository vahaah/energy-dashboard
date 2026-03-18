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

const FUELS = ["wind", "solar", "nuclear", "hydro", "biomass", "gas", "coal", "imports", "other"] as const;

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
              FUEL_LABELS[String(name)] ?? name,
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
              stroke={FUEL_COLORS[fuel]}
              fill={FUEL_COLORS[fuel]}
              fillOpacity={0.8}
              name={FUEL_LABELS[fuel]}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
