"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { CommodityPrice, CommodityRange } from "@/lib/types";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import {
  buildCommodityChartSeries,
  COMMODITY_SCALE_OPTIONS,
  commodityDateFromTime,
  commodityYAxis,
  formatCommodityPointNative,
  parseTooltipTime,
  scaleAxisLabel,
  scaleCaption,
  tooltipRowsAtTime,
  type CommodityChartSeries,
  type CommodityScale,
} from "@/lib/commodity-chart-model";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { TimeRangeSelector } from "@/components/time-range-selector";

interface Props {
  data: CommodityPrice[];
  range: CommodityRange;
  selectedSeries: string[];
}

type NativeTooltipProps = {
  active?: boolean;
  label?: string | number;
  range: CommodityRange;
  series: CommodityChartSeries[];
};

export function CommodityNativeTooltip({ active, label, range, series }: NativeTooltipProps) {
  const time = parseTooltipTime(label);
  if (!active || time == null) {
    return null;
  }

  const rows = tooltipRowsAtTime(series, time);
  if (rows.length === 0) {
    return null;
  }

  const hoverDate = commodityDateFromTime(time);

  return (
    <div
      className="rounded-lg px-3 py-2 text-[13px] text-white"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
    >
      <p className="mb-1 text-gray-800">{formatChartTooltip(time, range)}</p>
      {rows.map((row) => (
        <p key={row.commodity} style={{ color: row.color }}>
          {row.label}: {formatCommodityPointNative(row)}
          {row.date === hoverDate ? "" : ` · ${formatChartTooltip(row.date, range)}`}
        </p>
      ))}
    </div>
  );
}

export function CommodityPriceLines({
  series,
  range,
  scale,
  width,
  height,
}: {
  series: CommodityChartSeries[];
  range: CommodityRange;
  scale: CommodityScale;
  width?: number;
  height?: number;
}) {
  const times = series.flatMap((entry) => entry.points.map((point) => point.time));
  const domain: [number, number] | ["dataMin", "dataMax"] =
    times.length > 0 ? [Math.min(...times), Math.max(...times)] : ["dataMin", "dataMax"];
  const axisTicks = [...new Set(times)]
    .sort((left, right) => left - right)
    .map((time) => ({ time }));
  const yAxis = commodityYAxis(scale, series);
  let yAxisTitle: string | undefined;
  switch (scale) {
    case "index":
      break;
    case "native":
      yAxisTitle = scaleAxisLabel(scale);
      break;
    default: {
      const exhaustive: never = scale;
      return exhaustive;
    }
  }

  return (
    <LineChart
      data={axisTicks}
      width={width}
      height={height}
      margin={{ top: 5, right: 5, bottom: 5, left: 12 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
      <XAxis
        dataKey="time"
        type="number"
        domain={domain}
        scale="time"
        tickFormatter={(tick) => formatChartTick(Number(tick), range)}
        tick={{ fontSize: 11, fill: "#71717a" }}
        stroke="#27272a"
      />
      <YAxis
        type="number"
        scale={yAxis.scale}
        domain={yAxis.domain}
        ticks={yAxis.ticks}
        allowDataOverflow
        tick={{ fontSize: 11, fill: "#71717a" }}
        stroke="#27272a"
        label={
          yAxisTitle
            ? {
                value: yAxisTitle,
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#71717a" },
              }
            : undefined
        }
      />
      <Tooltip
        content={<CommodityNativeTooltip range={range} series={series} />}
        wrapperStyle={{ zIndex: 320 }}
      />
      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      {series.map((entry) => (
        <Line
          key={entry.commodity}
          data={entry.points}
          type="monotone"
          dataKey="value"
          stroke={entry.color}
          strokeWidth={2}
          dot={entry.monthly ? { r: 3, fill: entry.color, stroke: entry.color } : false}
          connectNulls
          isAnimationActive={false}
          name={entry.label}
        />
      ))}
    </LineChart>
  );
}

export function CommodityChart({ data, range, selectedSeries }: Props) {
  const [scale, setScale] = useState<CommodityScale>("index");
  const series = buildCommodityChartSeries(data, selectedSeries, scale);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-900">{scaleCaption(scale)}</p>
        <TimeRangeSelector
          value={scale}
          onChange={setScale}
          options={COMMODITY_SCALE_OPTIONS}
          compact
          ariaLabel="Price scale"
        />
      </div>
      <ResponsiveChartFrame className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <CommodityPriceLines series={series} range={range} scale={scale} />
        </ResponsiveContainer>
      </ResponsiveChartFrame>
    </div>
  );
}
