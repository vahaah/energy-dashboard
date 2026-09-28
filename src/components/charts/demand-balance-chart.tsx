"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";
import {
  DEMAND_SERIES_COLOR,
  DOMESTIC_GENERATION_SERIES_COLOR,
  EXPORT_GAP_COLOR,
  IMPORT_GAP_COLOR,
} from "@/lib/colors";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import {
  buildDemandBalanceSeries,
  formatEmbeddedMissingNote,
} from "@/lib/dashboard-model";
import {
  buildDemandBalanceChartPoints,
  demandBalanceXTicks,
  demandBalanceYTicks,
  formatDemandBalanceTick,
  formatDemandBalanceTooltipLabel,
  lastDefinedIndex,
  type DemandBalanceChartPoint,
} from "@/lib/generation-desk-view";

interface Props {
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
  range: TimeRange;
}

const SERIES_LABELS: Record<string, string> = {
  demandGw: "Demand",
  generationGw: "Domestic generation",
};

type DemandBalanceTooltipProps = {
  active?: boolean;
  label?: string | number;
    payload?: {
    dataKey?: string | number;
    name?: string;
    value?: number | string | null;
    payload?: DemandBalanceChartPoint;
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
  const series = payload.filter((entry) => {
    const key = String(entry.dataKey ?? entry.name ?? "");
    return key === "demandGw" || key === "generationGw";
  });

  return (
    <div
      className="rounded-lg px-3 py-2 text-[13px] text-white"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
    >
      <p className="mb-1">{formatDemandBalanceTooltipLabel(String(label), range)}</p>
      {series.map((entry) => {
        if (entry.value == null) {
          return null;
        }

        const key = String(entry.dataKey ?? entry.name ?? "");
        return (
          <p key={key}>
            {SERIES_LABELS[key] ?? key}: {Number(entry.value).toFixed(1)} GW
          </p>
        );
      })}
      {point?.importGw ? (
        <p>Imports: {point.importGw.toFixed(1)} GW</p>
      ) : null}
      {point?.exportGw ? (
        <p>Exports: {point.exportGw.toFixed(1)} GW</p>
      ) : null}
      {note ? <p className="mt-1 text-amber-200">{note}</p> : null}
    </div>
  );
}

export function DemandBalanceChart({ snapshots, generation, range }: Props) {
  const series = buildDemandBalanceSeries(snapshots, generation, range);
  const chartData = buildDemandBalanceChartPoints(series);
  const yTicks = demandBalanceYTicks(chartData);
  const xTicks = demandBalanceXTicks(
    chartData.map((point) => point.time),
    range
  );
  const demandLabelIndex = lastDefinedIndex(chartData, "demandGw");
  const generationLabelIndex = lastDefinedIndex(chartData, "generationGw");
  const yMax = yTicks.at(-1) ?? 40;

  return (
    <ResponsiveChartFrame className="h-60 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 108, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="time"
            ticks={xTicks}
            interval={0}
            minTickGap={24}
            tickFormatter={(value) => formatDemandBalanceTick(String(value), range)}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
          />
          <YAxis
            domain={[0, yMax]}
            ticks={yTicks}
            tickFormatter={(value) => Number(value).toFixed(1)}
            tick={{ fontSize: 11, fill: "#71717a" }}
            stroke="#27272a"
            width={44}
            label={{
              value: "GW",
              position: "insideTopLeft",
              offset: 8,
              style: { fontSize: 11, fill: "#71717a" },
            }}
          />
          <Tooltip
            content={<DemandBalanceTooltip range={range} />}
            wrapperStyle={{ zIndex: 320 }}
          />
          <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="gapBaseGw"
            stackId="gap"
            stroke="none"
            fill="transparent"
            legendType="none"
            tooltipType="none"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="importGw"
            stackId="gap"
            stroke="none"
            fill={IMPORT_GAP_COLOR}
            fillOpacity={0.28}
            name="Imports"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="exportGw"
            stackId="gap"
            stroke="none"
            fill={EXPORT_GAP_COLOR}
            fillOpacity={0.28}
            name="Exports"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="demandGw"
            stroke={DEMAND_SERIES_COLOR}
            strokeWidth={2}
            dot={false}
            name="Demand"
            connectNulls={false}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="demandGw"
              content={(props) => {
                const raw = props.value;
                return endLineLabel({
                  index: props.index,
                  x: props.x,
                  y: props.y,
                  value: typeof raw === "number" || typeof raw === "string" ? raw : undefined,
                  targetIndex: demandLabelIndex,
                  text: "Demand",
                  color: DEMAND_SERIES_COLOR,
                });
              }}
            />
          </Line>
          <Line
            type="monotone"
            dataKey="generationGw"
            stroke={DOMESTIC_GENERATION_SERIES_COLOR}
            strokeWidth={2}
            dot={false}
            name="Domestic generation"
            connectNulls={false}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="generationGw"
              content={(props) => {
                const raw = props.value;
                return endLineLabel({
                  index: props.index,
                  x: props.x,
                  y: props.y,
                  value: typeof raw === "number" || typeof raw === "string" ? raw : undefined,
                  targetIndex: generationLabelIndex,
                  text: "Generation",
                  color: DOMESTIC_GENERATION_SERIES_COLOR,
                });
              }}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </ResponsiveChartFrame>
  );
}

function endLineLabel({
  index,
  x,
  y,
  value,
  targetIndex,
  text,
  color,
}: {
  index?: number;
  x?: number | string;
  y?: number | string;
  value?: number | string;
  targetIndex: number;
  text: string;
  color: string;
}) {
  if (index !== targetIndex || value == null || x == null || y == null) {
    return null;
  }

  return (
    <text
      x={Number(x) + 8}
      y={Number(y)}
      fill={color}
      fontSize={12}
      dominantBaseline="middle"
    >
      {text}
    </text>
  );
}
