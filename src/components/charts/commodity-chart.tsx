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
} from "recharts";
import type {
  CommodityChartSeries,
  CommodityPrice,
  CommodityRange,
  CommodityScale,
} from "@/lib/types";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { chartAnimation, chartAxisLine, chartAxisTick, chartGrid, chartLine, CHART_HEIGHT_HERO } from "@/lib/chart-theme";
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
} from "@/lib/commodity-chart-model";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { captionCommodities } from "@/lib/attribution";

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
    <ChartTooltipCard time={formatChartTooltip(time, range)}>
      {rows.map((row) => (
        <ChartTooltipRow
          key={row.commodity}
          color={row.color}
          label={row.label}
          value={`${formatCommodityPointNative(row)}${
            row.date === hoverDate ? "" : ` · ${formatChartTooltip(row.date, range)}`
          }`}
        />
      ))}
    </ChartTooltipCard>
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
      <CartesianGrid {...chartGrid} />
      <XAxis
        dataKey="time"
        type="number"
        domain={domain}
        scale="time"
        tickFormatter={(tick) => formatChartTick(Number(tick), range)}
        tick={chartAxisTick}
        {...chartAxisLine}
      />
      <YAxis
        type="number"
        scale={yAxis.scale}
        domain={yAxis.domain}
        ticks={yAxis.ticks}
        allowDataOverflow
        tick={chartAxisTick}
        {...chartAxisLine}
        label={
          yAxisTitle
            ? {
                value: yAxisTitle,
                angle: -90,
                position: "insideLeft",
                style: chartAxisTick,
              }
            : undefined
        }
      />
      <Tooltip
        cursor={{ stroke: "var(--gray-alpha-400)", strokeWidth: 1 }}
        content={<CommodityNativeTooltip range={range} series={series} />}
        wrapperStyle={{ zIndex: 320 }}
      />
      {series.map((entry) => (
        <Line
          key={entry.commodity}
          data={entry.points}
          type="monotone"
          dataKey="value"
          stroke={entry.color}
          name={entry.label}
          {...chartLine}
          {...chartAnimation}
          connectNulls
          dot={entry.monthly ? { r: 3, fill: entry.color, stroke: entry.color } : false}
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
        <p className="text-xs text-gray-900">
          {scaleCaption(scale)}. {captionCommodities()}
        </p>
        <TimeRangeSelector
          value={scale}
          onChange={setScale}
          options={COMMODITY_SCALE_OPTIONS}
          compact
          ariaLabel="Price scale"
        />
      </div>
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <CommodityPriceLines series={series} range={range} scale={scale} />
        </ResponsiveContainer>
      </ResponsiveChartFrame>
    </div>
  );
}
