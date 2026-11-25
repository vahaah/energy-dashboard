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
import { GAS_UNIT_DAY } from "@/lib/gas/copy";
import type { GasSeriesPoint } from "@/lib/gas/view";
import { formatDisplay } from "@/lib/display-rounding";

const SUPPLY = "var(--gray-1000)";
const DEMAND = "var(--chart-gas)";
const FORECAST = "var(--chart-wind)";

type ChartRow = {
  time: number;
  label: string;
  supply: number | null;
  demand: number | null;
  supplyForecast: number | null;
  demandForecast: number | null;
};

export function GasSeriesChart({
  points,
  now,
  unit = GAS_UNIT_DAY,
}: {
  points: readonly GasSeriesPoint[];
  now: string | null;
  unit?: string;
}) {
  if (points.length === 0) {
    return null;
  }
  const data: ChartRow[] = points.map((point) => ({
    time: Date.parse(point.at),
    label: point.label,
    supply: point.supply,
    demand: point.demand,
    supplyForecast: point.supplyForecast,
    demandForecast: point.demandForecast,
  }));
  const nowMs = now ? Date.parse(now) : Number.NaN;
  const showForecast = data.some((row) => row.supplyForecast != null || row.demandForecast != null);
  const showDemand = data.some((row) => row.demand != null || row.demandForecast != null);

  return (
    <div className="mt-4 min-w-0">
      <ResponsiveChartFrame className="h-[200px] md:h-[280px]" summary="National Transmission System series. Values are in the table on this page.">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--gray-alpha-400)" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value: number) => data.find((row) => row.time === value)?.label ?? ""}
            stroke="var(--gray-900)"
            tick={{ fill: "var(--gray-900)", fontSize: 13 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--gray-900)"
            tick={{ fill: "var(--gray-900)", fontSize: 13 }}
            tickFormatter={(value: number) => formatDisplay(value, 0.1)}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip content={<GasSeriesTooltip unit={unit} />} />
          {Number.isFinite(nowMs) ? (
            <ReferenceLine
              x={nowMs}
              stroke="var(--gray-900)"
              strokeDasharray="4 4"
              label={{ value: "Now", position: "insideTopLeft", fill: "var(--gray-900)", fontSize: 13 }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="supply"
            name="Supply"
            stroke={SUPPLY}
            strokeWidth={2}
            dot={data.length < 2 ? { r: 3, fill: SUPPLY } : false}
            connectNulls
          />
          {showDemand ? (
            <Line
              type="monotone"
              dataKey="demand"
              name="Demand"
              stroke={DEMAND}
              strokeWidth={2}
              dot={data.length < 2 ? { r: 3, fill: DEMAND } : false}
              connectNulls
            />
          ) : null}
          {showForecast ? (
            <Line
              type="monotone"
              dataKey="supplyForecast"
              name="Forecast"
              stroke={FORECAST}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={data.length < 2 ? { r: 3, fill: FORECAST } : false}
              connectNulls
            />
          ) : null}
        </LineChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-label-13 text-gray-900">
        <Key swatch={SUPPLY} label="Supply" />
        {showDemand ? <Key swatch={DEMAND} label="Demand" /> : null}
        {showForecast ? <Key swatch={FORECAST} label="Forecast" dashed /> : null}
      </p>
    </div>
  );
}

function Key({ swatch, label, dashed = false }: { swatch: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-0.5 w-3 shrink-0 ${dashed ? "border-t border-dashed" : ""}`}
        style={dashed ? { borderColor: swatch } : { backgroundColor: swatch }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function GasSeriesTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number | string | null; color?: string; payload?: ChartRow }>;
  unit: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row || !payload) {
    return null;
  }
  return (
    <ChartTooltipCard time={row.label}>
      {payload.map((entry) =>
        entry.value == null || entry.name == null ? null : (
          <ChartTooltipRow
            key={entry.name}
            color={entry.color ?? SUPPLY}
            label={entry.name}
            value={`${formatDisplay(Number(entry.value), 0.1)} ${unit}`}
          />
        ),
      )}
    </ChartTooltipCard>
  );
}
