"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipCard } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { ForecastBadge } from "@/components/ui/forecast-badge";
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
import type { ForecastPoint } from "@/lib/forecast-model";
import {
  formatTinybirdDateTime,
  getLondonDateTimeParts,
  parseUtcDateTime,
} from "@/lib/london-time";
import type { EnergySnapshot, TimeRange } from "@/lib/types";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
  forecast?: ForecastPoint[];
  now?: Date | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function CarbonIntensityChart({ data, range, forecast = [], now = null }: Props) {
  const chartData = mergeCarbonSeries(data, forecast);
  const nowX = nowMarker(chartData, now);
  const lastForecast = chartData.at(-1)?.time;
  const yMax = Math.max(
    80,
    ...chartData.flatMap((point) => [point.actual ?? 0, point.forecast ?? 0])
  );
  const ceiling = Math.ceil(yMax / 50) * 50;
  const multiDay = forecast.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {forecast.length > 0 ? (
        <div className="flex items-center gap-2">
          <ForecastBadge />
          <p className="text-label-12 text-gray-900">
            Dashed line and shaded band are the 48-hour carbon forecast.
          </p>
        </div>
      ) : null}
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
            {nowX && lastForecast ? (
              <ReferenceArea
                x1={nowX}
                x2={lastForecast}
                fill="var(--gray-alpha-100)"
                strokeOpacity={0}
              />
            ) : null}
            {nowX ? (
              <ReferenceLine
                x={nowX}
                stroke="var(--gray-700)"
                strokeDasharray="4 4"
                label={{
                  value: "Now",
                  position: "insideTopLeft",
                  fill: "var(--gray-700)",
                  fontSize: 12,
                }}
              />
            ) : null}
            <XAxis
              dataKey="time"
              tickFormatter={(t) =>
                multiDay ? formatMultiDayTick(String(t)) : formatChartTick(String(t), range)
              }
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
    </div>
  );
}

export function mergeCarbonSeries(
  data: EnergySnapshot[],
  forecast: ForecastPoint[]
): Array<{ time: string; actual: number | null; forecast: number | null }> {
  const byTime = new Map<string, { time: string; actual: number | null; forecast: number | null }>();
  for (const row of data) {
    byTime.set(row.timestamp, {
      time: row.timestamp,
      actual: row.carbon_intensity == null ? null : Math.round(row.carbon_intensity),
      forecast: null,
    });
  }
  for (const point of forecast) {
    const existing = byTime.get(point.time);
    if (existing) {
      existing.forecast = Math.round(point.value);
      continue;
    }
    byTime.set(point.time, {
      time: point.time,
      actual: null,
      forecast: Math.round(point.value),
    });
  }
  return [...byTime.values()].sort(
    (left, right) => parseUtcDateTime(left.time).getTime() - parseUtcDateTime(right.time).getTime()
  );
}

function nowMarker(
  chartData: Array<{ time: string }>,
  now: Date | null
): string | null {
  if (!now || chartData.length === 0) {
    return null;
  }
  const nowTime = formatTinybirdDateTime(now);
  const exact = chartData.find((point) => point.time === nowTime);
  if (exact) {
    return exact.time;
  }
  const future = chartData.find((point) => point.time >= nowTime);
  return future?.time ?? chartData.at(-1)?.time ?? null;
}

function formatMultiDayTick(value: string): string {
  const date = parseUtcDateTime(value);
  const parts = getLondonDateTimeParts(date);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  return `${parts.day} ${MONTHS[parts.month - 1]} ${hour}:${minute}`;
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
