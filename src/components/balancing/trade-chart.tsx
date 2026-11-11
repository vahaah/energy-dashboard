"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { LineSample, Swatch } from "@/components/balancing/chart-marks";
import { monthTicks, poundChartAxis } from "@/lib/balancing/axis";
import { netTradePence } from "@/lib/balancing/aggregate";
import { BALANCING_EXPORTS_COLOR, BALANCING_IMPORTS_COLOR } from "@/lib/balancing/categories";
import { formatPounds } from "@/lib/balancing/money";
import type { TradeMonth } from "@/lib/balancing/types";
import { chartAxisLine, chartAxisTick, chartGrid, chartLine, CHART_HEIGHT_HERO } from "@/lib/chart-theme";

export type TradeChartRow = {
  month: string;
  imports: number;
  exports: number;
  net: number | null;
  provisional: boolean;
  gap: boolean;
};

export function tradeChartRows(months: readonly TradeMonth[]): TradeChartRow[] {
  return months.map((month) => {
    let imports = 0;
    let exports = 0;
    for (const country of month.countries) {
      imports += country.import_pence;
      exports += country.export_pence;
    }
    return {
      month: month.month,
      imports,
      exports: -exports,
      net: netTradePence({ import_pence: imports, export_pence: exports }),
      provisional: month.provisional,
      gap: false,
    };
  });
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) {
    return month;
  }
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );
}

function TradeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: TradeChartRow }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.gap) {
    return null;
  }
  return (
    <ChartTooltipCard time={`${formatMonth(point.month)}${point.provisional ? " · Incomplete" : ""}`}>
      <ChartTooltipRow color={BALANCING_IMPORTS_COLOR} label="Imports" value={formatPounds(point.imports, 1)} />
      <ChartTooltipRow color={BALANCING_EXPORTS_COLOR} label="Exports" value={formatPounds(Math.abs(point.exports), 1)} />
      <ChartTooltipRow color="var(--gray-1000)" label="Net imports" value={formatPounds(point.net ?? 0, 1)} />
    </ChartTooltipCard>
  );
}

export function TradeChart({ rows }: { rows: TradeChartRow[] }) {
  const axis = poundChartAxis(rows.flatMap((row) => [row.imports, row.exports, row.net ?? 0]));
  const ticks = monthTicks(rows.map((row) => row.month));
  return (
    <div className="min-w-0">
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              ticks={ticks}
              interval={ticks ? 0 : "preserveStartEnd"}
              minTickGap={ticks ? 0 : 24}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <YAxis
              domain={axis.domain}
              ticks={axis.ticks}
              tickFormatter={axis.format}
              width={64}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <Tooltip content={<TradeTooltip />} wrapperStyle={{ zIndex: 30 }} />
            <Bar dataKey="imports" fill={BALANCING_IMPORTS_COLOR} isAnimationActive={false} />
            <Bar dataKey="exports" fill={BALANCING_EXPORTS_COLOR} isAnimationActive={false} />
            <Line dataKey="net" stroke="var(--gray-1000)" {...chartLine} />
          </ComposedChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      <ul className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-label-13 text-gray-900">
        <li className="inline-flex items-center gap-1.5">
          <Swatch color={BALANCING_IMPORTS_COLOR} />
          Imports
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Swatch color={BALANCING_EXPORTS_COLOR} />
          Exports
        </li>
        <li className="inline-flex items-center gap-1.5">
          <LineSample />
          Net imports (imports minus exports)
        </li>
      </ul>
    </div>
  );
}
