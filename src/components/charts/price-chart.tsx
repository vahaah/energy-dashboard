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
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
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

export type PriceSeries = "mid" | "system";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
  series?: PriceSeries;
}

export function ElectricityPriceTooltip({
  active,
  label,
  payload,
  range,
  name,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value?: number | string | null }>;
  range: TimeRange;
  name: string;
}) {
  if (!active || payload == null || payload.length === 0 || label == null) {
    return null;
  }

  const value = payload[0]?.value;
  return (
    <ChartTooltipCard time={formatChartTooltip(String(label), range)}>
      <ChartTooltipRow
        color="var(--gray-1000)"
        label={name}
        value={value == null ? "—" : `£${Number(value).toFixed(2)}`}
      />
    </ChartTooltipCard>
  );
}

export function ElectricityPriceChart({ data, range, series = "mid" }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    price: priceValue(d, series),
  }));
  const name = series === "mid" ? "Market price" : "System price";
  if (!chartData.some((point) => point.price != null)) {
    return (
      <p className="text-copy-14 text-gray-900">
        {series === "mid"
          ? "No short-term wholesale market prices in this window."
          : "No system prices in this window."}
      </p>
    );
  }

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
            content={<ElectricityPriceTooltip name={name} range={range} />}
            wrapperStyle={{ zIndex: 320 }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--gray-1000)"
            name={name}
            {...chartHeroLine}
            {...chartAnimation}
          />
        </LineChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}

function priceValue(snapshot: EnergySnapshot, series: PriceSeries): number | null {
  const value = series === "mid" ? snapshot.price_mid_gbp_mwh : snapshot.price_gbp_mwh;
  return value == null ? null : Math.round(value * 100) / 100;
}
