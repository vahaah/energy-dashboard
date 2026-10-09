"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
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
  chartArea,
  chartAxisLine,
  chartAxisTick,
  chartGrid,
  chartHeroLine,
  CHART_HEIGHT_HERO,
} from "@/lib/chart-theme";
import { CARBON_INDEX_BANDS, carbonIndexColor } from "@/lib/colors";
import type { EnergySnapshot, TimeRange } from "@/lib/types";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
}

export function CarbonIntensityChart({ data, range }: Props) {
  const chartData = data.map((d) => ({
    time: d.timestamp,
    actual: d.carbon_intensity == null ? null : Math.round(d.carbon_intensity),
    forecast: d.carbon_forecast == null ? null : Math.round(d.carbon_forecast),
  }));
  const yMax = Math.max(
    80,
    ...chartData.flatMap((point) => [point.actual ?? 0, point.forecast ?? 0])
  );
  const ceiling = Math.ceil(yMax / 50) * 50;

  return (
    <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid {...chartGrid} />
          {carbonBands(ceiling).map((band) => (
            <ReferenceArea
              key={band.index}
              y1={band.y1}
              y2={band.y2}
              fill={carbonIndexColor(band.index)}
              fillOpacity={0.06}
              strokeOpacity={0}
            />
          ))}
          <XAxis
            dataKey="time"
            tickFormatter={(t) => formatChartTick(String(t), range)}
            tick={chartAxisTick}
            {...chartAxisLine}
          />
          <YAxis
            domain={[0, ceiling]}
            tick={chartAxisTick}
            {...chartAxisLine}
            width={44}
            tickFormatter={(value: number) => String(value)}
            label={{
              value: "g",
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
              const rows = [...payload]
                .filter((entry) => entry.value != null)
                .sort((left, right) => Number(right.value) - Number(left.value));
              return (
                <ChartTooltipCard time={formatChartTooltip(String(label), range)}>
                  {rows.map((entry) => (
                    <p key={String(entry.dataKey)} className="flex justify-between gap-6">
                      <span>{entry.name}</span>
                      <span className="tabular-nums">{Number(entry.value).toFixed(0)} g</span>
                    </p>
                  ))}
                </ChartTooltipCard>
              );
            }}
            wrapperStyle={{ zIndex: 320 }}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="var(--gray-1000)"
            name="Actual"
            {...chartHeroLine}
            {...chartAnimation}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="var(--gray-700)"
            strokeDasharray="4 4"
            fill="transparent"
            name="Forecast"
            {...chartArea}
            {...chartAnimation}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}

function carbonBands(ceiling: number): Array<{ index: string; y1: number; y2: number }> {
  let previous = 0;
  const bands: Array<{ index: string; y1: number; y2: number }> = [];
  for (const band of CARBON_INDEX_BANDS) {
    const y2 = Math.min(band.max, ceiling);
    if (y2 <= previous) {
      continue;
    }
    bands.push({ index: band.index, y1: previous, y2 });
    previous = y2;
  }
  return bands;
}
