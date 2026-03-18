"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FUEL_COLORS, FUEL_LABELS } from "@/lib/colors";

interface Props {
  data: Record<string, number>; // { gas: 18.5, wind: 34.1, ... }
}

export function GenerationMixChart({ data }: Props) {
  const items = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([fuel, pct]) => ({
      name: FUEL_LABELS[fuel] ?? fuel,
      value: Math.round(pct * 10) / 10,
      color: FUEL_COLORS[fuel] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {items.map((item, i) => (
              <Cell key={i} fill={item.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${value}%`}
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
