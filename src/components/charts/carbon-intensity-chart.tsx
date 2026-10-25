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
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { useElementWidth } from "@/components/charts/use-element-width";
import { DataStateNotice } from "@/components/ui/data-state";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { chartTimeMs, evenTimeTicks, timeTickCount } from "@/lib/chart-time";
import {
  chartAnimation,
  chartArea,
  chartAxisLine,
  chartAxisTick,
  chartGrid,
  chartHeroLine,
  chartYAxisUnitLabel,
  CHART_HEIGHT_HERO,
} from "@/lib/chart-theme";
import { CARBON_INDEX_BANDS, carbonIndexColor } from "@/lib/colors";
import type { ForecastPoint } from "@/lib/forecast-model";
import { getLondonDateTimeParts } from "@/lib/london-time";
import type { EnergySnapshot, TimeRange } from "@/lib/types";

interface Props {
  data: EnergySnapshot[];
  range: TimeRange;
  forecast?: ForecastPoint[];
  now?: Date | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const COMPACT_CHART_WIDTH = 480;

const CARBON_SERIES_COLORS: Record<string, string> = {
  actual: "var(--gray-1000)",
  forecast: "var(--gray-700)",
};

type CarbonTooltipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | string | null;
  color?: string;
};

export function CarbonIntensityTooltip({
  active,
  label,
  payload,
  range,
}: {
  active?: boolean;
  label?: string | number;
  payload?: CarbonTooltipEntry[];
  range: TimeRange;
}) {
  if (!active || payload == null || payload.length === 0 || label == null) {
    return null;
  }

  const rows = [...payload]
    .filter((entry) => entry.value != null)
    .sort((left, right) => Number(right.value) - Number(left.value));

  return (
    <ChartTooltipCard time={formatChartTooltip(String(label), range)}>
      {rows.map((entry) => {
        const key = String(entry.dataKey ?? entry.name ?? "");
        return (
          <ChartTooltipRow
            key={key}
            color={CARBON_SERIES_COLORS[key] ?? entry.color ?? "var(--gray-1000)"}
            label={String(entry.name ?? key)}
            value={`${Number(entry.value).toFixed(0)} g`}
          />
        );
      })}
    </ChartTooltipCard>
  );
}

export function CarbonIntensityChart({ data, range, forecast = [], now = null }: Props) {
  const { ref, width } = useElementWidth();
  const compact = width === 0 || width < COMPACT_CHART_WIDTH;
  const chartData = mergeCarbonSeries(data, forecast);
  const nowX = now?.getTime() ?? null;
  const lastForecast = chartData.at(-1)?.ts;
  const firstTs = chartData[0]?.ts;
  const domain: [number, number] | undefined =
    firstTs != null && lastForecast != null ? [firstTs, lastForecast] : undefined;
  const xTicks =
    domain != null
      ? evenTimeTicks(domain[0], domain[1], timeTickCount(domain[1] - domain[0], compact))
      : [];
  const yMax = Math.max(
    80,
    ...chartData.flatMap((point) => [point.actual ?? 0, point.forecast ?? 0])
  );
  const ceiling = Math.ceil(yMax / 50) * 50;
  const multiDay = forecast.length > 0;

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      {forecast.length > 0 ? (
        <div className="flex items-center gap-2">
          <DataStateNotice state="forecast" />
          <p className="text-label-12 text-gray-900">
            Dashed line and shaded band are the 48-hour carbon forecast.
          </p>
        </div>
      ) : null}
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 24, right: 8, bottom: compact && multiDay ? 22 : 4, left: 0 }}
          >
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
                  fontSize: 13,
                }}
              />
            ) : null}
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={domain ?? ["dataMin", "dataMax"]}
              ticks={xTicks}
              interval={0}
              minTickGap={compact ? 64 : 24}
              tick={(props) => (
                <CarbonXTick
                  x={props.x}
                  y={props.y}
                  payload={props.payload}
                  range={range}
                  multiDay={multiDay}
                  compact={compact}
                />
              )}
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
              ...chartYAxisUnitLabel,
            }}
            />
            <Tooltip
              cursor={{ stroke: "var(--gray-alpha-400)", strokeWidth: 1 }}
              content={<CarbonIntensityTooltip range={range} />}
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

export type CarbonChartPoint = {
  time: string;
  ts: number;
  actual: number | null;
  forecast: number | null;
};

export function mergeCarbonSeries(
  data: EnergySnapshot[],
  forecast: ForecastPoint[]
): CarbonChartPoint[] {
  const byTime = new Map<string, CarbonChartPoint>();
  for (const row of data) {
    byTime.set(row.timestamp, {
      time: row.timestamp,
      ts: chartTimeMs(row.timestamp),
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
      ts: chartTimeMs(point.time),
      actual: null,
      forecast: Math.round(point.value),
    });
  }
  return [...byTime.values()].sort((left, right) => left.ts - right.ts);
}

function formatMultiDayTick(value: string | number, compact: boolean): string[] {
  const date = new Date(chartTimeMs(value));
  const parts = getLondonDateTimeParts(date);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  if (compact) {
    return [`${parts.day} ${MONTHS[parts.month - 1]}`, `${hour}:${minute}`];
  }
  return [`${parts.day} ${MONTHS[parts.month - 1]} ${hour}:${minute}`];
}

function CarbonXTick({
  x,
  y,
  payload,
  range,
  multiDay,
  compact,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
  range: TimeRange;
  multiDay: boolean;
  compact: boolean;
}) {
  if (x == null || y == null || payload?.value == null) {
    return null;
  }

  const lines = multiDay
    ? formatMultiDayTick(payload.value, compact)
    : [formatChartTick(payload.value, range)];

  return (
    <text
      x={Number(x)}
      y={Number(y)}
      fill={chartAxisTick.fill}
      fontSize={chartAxisTick.fontSize}
      textAnchor="middle"
    >
      {lines.map((line, index) => (
        <tspan key={line} x={Number(x)} dy={index === 0 ? 12 : 14}>
          {line}
        </tspan>
      ))}
    </text>
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
