"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipCard } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import {
  chartAnimation,
  chartAxisLine,
  chartAxisTick,
  chartGrid,
  chartHeroLine,
  CHART_HEIGHT_HERO,
} from "@/lib/chart-theme";
import type { EnergySnapshot, TimeRange } from "@/lib/types";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
}

export function ElectricityPriceChart({ data, range }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    price: d.price_gbp_mwh == null ? null : Math.round(d.price_gbp_mwh * 100) / 100,
  }));

  return (
    <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid {...chartGrid} />
          <XAxis
            dataKey="time"
            tickFormatter={(t) => formatChartTick(String(t), range)}
            tick={chartAxisTick}
            {...chartAxisLine}
          />
          <YAxis
            tick={chartAxisTick}
            {...chartAxisLine}
            width={48}
            tickFormatter={(value: number) => String(value)}
            label={{
              value: "£/MWh",
              position: "insideTopLeft",
              offset: 8,
              style: chartAxisTick,
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--gray-alpha-400)", strokeWidth: 1 }}
            content={({ active, label, payload }) => {
              if (!active || payload == null || payload.length === 0 || label == null) {
                return null;
              }
              const value = payload[0]?.value;
              return (
                <ChartTooltipCard time={formatChartTooltip(String(label), range)}>
                  <p className="flex justify-between gap-6">
                    <span>System price</span>
                    <span className="tabular-nums">{value == null ? "—" : `£${Number(value).toFixed(2)}`}</span>
                  </p>
                </ChartTooltipCard>
              );
            }}
            wrapperStyle={{ zIndex: 320 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--gray-1000)"
            name="System price"
            {...chartHeroLine}
            {...chartAnimation}
          />
        </LineChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
