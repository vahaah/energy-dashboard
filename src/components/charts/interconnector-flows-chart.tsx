"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  chartLine,
  CHART_HEIGHT_HERO,
  CHART_SERIES_CAP,
} from "@/lib/chart-theme";
import { INTERCONNECTOR_COLORS, INTERCONNECTOR_LABELS } from "@/lib/colors";
import { isInterconnectorFuel, normalizeFuelType } from "@/lib/dashboard-model";
import type { Generation5min, TimeRange } from "@/lib/types";

interface Props {
  data: Generation5min[];
  range: TimeRange;
}

type InterconnectorTooltipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | string | null;
  color?: string;
};

export function InterconnectorFlowsTooltip({
  active,
  label,
  payload,
  range,
}: {
  active?: boolean;
  label?: string | number;
  payload?: InterconnectorTooltipEntry[];
  range: TimeRange;
}) {
  if (!active || payload == null || payload.length === 0 || label == null) {
    return null;
  }

  const rows = [...payload]
    .filter((entry) => entry.value != null)
    .sort((left, right) => Math.abs(Number(right.value)) - Math.abs(Number(left.value)));

  return (
    <ChartTooltipCard time={formatChartTooltip(String(label), range)}>
      {rows.map((entry) => {
        const key = String(entry.dataKey ?? entry.name ?? "");
        return (
          <ChartTooltipRow
            key={key}
            color={connectorSwatch(key, entry.color)}
            label={connectorLabel(String(entry.name ?? key))}
            value={`${Number(entry.value).toFixed(2)} GW`}
          />
        );
      })}
    </ChartTooltipCard>
  );
}

export function InterconnectorFlowsChart({ data, range }: Props) {
  const byTimestamp = new Map<string, Record<string, number | string>>();
  const connectorAbs = new Map<string, number>();

  for (const row of data) {
    if (!isInterconnectorFuel(row.fuel_type)) continue;

    const interconnector = normalizeFuelType(row.fuel_type);
    if (!byTimestamp.has(row.timestamp)) {
      byTimestamp.set(row.timestamp, { time: row.timestamp, net: 0 });
    }

    const entry = byTimestamp.get(row.timestamp);
    if (!entry) {
      continue;
    }
    entry[interconnector] = Number(entry[interconnector] ?? 0) + row.generation_mw / 1000;
    entry.net = Number(entry.net ?? 0) + row.generation_mw / 1000;
    connectorAbs.set(
      interconnector,
      (connectorAbs.get(interconnector) ?? 0) + Math.abs(row.generation_mw)
    );
  }

  const ranked = Array.from(connectorAbs.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([connector]) => connector);
  const shown = ranked.slice(0, CHART_SERIES_CAP);
  const overflow = ranked.slice(CHART_SERIES_CAP);

  const chartData = Array.from(byTimestamp.values())
    .map((point) => {
      if (overflow.length === 0) {
        return point;
      }
      const other = overflow.reduce((sum, connector) => sum + Number(point[connector] ?? 0), 0);
      return { ...point, other };
    })
    .sort(
      (a, b) =>
        new Date(a.time as string).getTime() - new Date(b.time as string).getTime()
    );

  const series = overflow.length > 0 ? [...shown, "other"] : shown;

  return (
    <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid {...chartGrid} />
          <XAxis
            dataKey="time"
            tickFormatter={(value) => formatChartTick(String(value), range)}
            tick={chartAxisTick}
            {...chartAxisLine}
          />
          <YAxis
            tickFormatter={(value) => `${Number(value).toFixed(1)}`}
            tick={chartAxisTick}
            {...chartAxisLine}
            width={44}
            label={{
              value: "GW",
              position: "insideTopLeft",
              offset: 8,
              style: chartAxisTick,
            }}
          />
          <Tooltip
            cursor={{ stroke: "var(--gray-alpha-400)", strokeWidth: 1 }}
            content={<InterconnectorFlowsTooltip range={range} />}
            wrapperStyle={{ zIndex: 320 }}
          />
          <ReferenceLine y={0} stroke="var(--gray-alpha-200)" />
          {series.map((connector) => (
            <Line
              key={connector}
              type="monotone"
              dataKey={connector}
              stroke={connector === "other" ? "var(--chart-other)" : INTERCONNECTOR_COLORS[connector] ?? "#94a3b8"}
              name={connectorLabel(connector)}
              {...chartLine}
              {...chartAnimation}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}

function connectorLabel(name: string): string {
  if (name === "other") {
    return "Other";
  }
  return INTERCONNECTOR_LABELS[name] ?? name;
}

function connectorSwatch(dataKey: string, color?: string): string {
  if (dataKey === "other") {
    return "var(--chart-other)";
  }
  return INTERCONNECTOR_COLORS[dataKey] ?? color ?? "var(--chart-other)";
}
