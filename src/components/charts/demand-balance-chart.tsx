"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";
import { formatChartTick, formatChartTooltip } from "@/lib/chart-formatting";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import {
  buildDemandBalanceSeries,
  formatEmbeddedMissingNote,
  type DemandBalancePoint,
} from "@/lib/dashboard-model";

interface Props {
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
  range: TimeRange;
}

const SERIES_LABELS: Record<string, string> = {
  demandMw: "Demand",
  domesticGenerationMw: "Domestic generation",
};

type DemandBalanceTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: {
    dataKey?: string | number;
    name?: string;
    value?: number | string | null;
    payload?: DemandBalancePoint;
  }[];
  range: TimeRange;
};

export function DemandBalanceTooltip({
  active,
  label,
  payload,
  range,
}: DemandBalanceTooltipProps) {
  if (!active || payload == null || payload.length === 0 || label == null) {
    return null;
  }

  const point = payload.at(0)?.payload;
  const note = point ? formatEmbeddedMissingNote(point.embeddedMissing) : null;

  return (
    <div
      className="rounded-lg px-3 py-2 text-[13px] text-white"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
    >
      <p className="mb-1">{formatChartTooltip(label, range)}</p>
      {payload.map((entry) => {
        if (entry.value == null) {
          return null;
        }

        const key = String(entry.dataKey ?? entry.name ?? "");
        return (
          <p key={key}>
            {SERIES_LABELS[key] ?? key}: {Math.round(Number(entry.value)).toLocaleString()} MW
          </p>
        );
      })}
      {note ? <p className="mt-1 text-amber-200">{note}</p> : null}
    </div>
  );
}

export function DemandBalanceChart({ snapshots, generation, range }: Props) {
  const chartData = buildDemandBalanceSeries(snapshots, generation, range);

  return (
    <ResponsiveChartFrame className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            tickFormatter={(value) => formatChartTick(String(value), range)}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
            label={{
              value: "MW",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "#71717a" },
            }}
          />
          <Tooltip
            content={<DemandBalanceTooltip range={range} />}
            wrapperStyle={{ zIndex: 320 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="demandMw"
            stroke="#f8fafc"
            strokeWidth={2}
            dot={false}
            name="Demand"
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="domesticGenerationMw"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            name="Domestic generation"
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}
