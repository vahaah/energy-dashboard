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
import { ChartLegend } from "@/components/charts/chart-legend";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import {
  chartAnimation,
  chartAxisLine,
  chartAxisTick,
  chartGrid,
  chartLine,
  CHART_HEIGHT_SMALL,
} from "@/lib/chart-theme";
import type { YearlyAverage } from "@/lib/historic-mix";
import { NESO_OPEN_DATA_ATTRIBUTION } from "@/lib/attribution";

const COAL_COLOR = "#57534e";
const WIND_COLOR = "#0ea5e9";

export function EnergyTransition({
  yearly,
  sentences,
}: {
  yearly: YearlyAverage[];
  sentences: [string, string, string] | null;
}) {
  const data = yearly.map((row) => ({
    year: row.year,
    coal: Number(row.coalPct.toFixed(1)),
    wind: Number(row.windPct.toFixed(1)),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
      <div className="min-w-0">
      <ResponsiveChartFrame className={CHART_HEIGHT_SMALL}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis
              dataKey="year"
              {...chartAxisLine}
              tick={{ ...chartAxisTick, fontSize: 13 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              {...chartAxisLine}
              tick={{ ...chartAxisTick, fontSize: 13 }}
              width={36}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              {...chartAnimation}
              content={<TransitionTooltip />}
              cursor={{ stroke: "var(--gray-alpha-400)", strokeWidth: 1 }}
            />
            <Line {...chartLine} type="monotone" dataKey="coal" stroke={COAL_COLOR} name="Coal" />
            <Line {...chartLine} type="monotone" dataKey="wind" stroke={WIND_COLOR} name="Wind" strokeDasharray="6 4" />
          </LineChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      <ChartLegend
        items={[
          { id: "coal", label: "Coal, share of generation", color: COAL_COLOR },
          { id: "wind", label: "Wind, share of generation", color: WIND_COLOR, dash: "6 4" },
        ]}
      />
      {data.length > 0 ? (
        <p className="mt-2 text-copy-14 text-gray-1000">
          {data[data.length - 1]?.year}: Coal {data[data.length - 1]?.coal}% · Wind {data[data.length - 1]?.wind}% of generation
        </p>
      ) : null}
      </div>
      <div className="space-y-3 text-copy-14 text-gray-1000">
        {sentences ? (
          sentences.map((sentence) => <p key={sentence}>{sentence}</p>)
        ) : (
          <p className="text-gray-900">Yearly averages are still catching up.</p>
        )}
        <p className="text-label-12 text-gray-900">{NESO_OPEN_DATA_ATTRIBUTION}.</p>
      </div>
    </div>
  );
}

export function TransitionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <ChartTooltipCard time={String(label)}>
      {payload.map((entry) => (
        <ChartTooltipRow
          key={entry.name}
          color={entry.color ?? "var(--gray-1000)"}
          label={String(entry.name ?? "")}
          value={`${Number(entry.value ?? 0).toFixed(1)}%`}
        />
      ))}
    </ChartTooltipCard>
  );
}
