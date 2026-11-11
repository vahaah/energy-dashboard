"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { netTradePence } from "@/lib/balancing/aggregate";
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
    <ChartTooltipCard time={`${formatMonth(point.month)}${point.provisional ? " · Provisional" : ""}`}>
      <ChartTooltipRow color="var(--chart-imports)" label="Imports" value={formatPounds(point.imports, 1)} />
      <ChartTooltipRow color="var(--chart-wind)" label="Exports" value={formatPounds(Math.abs(point.exports), 1)} />
      <ChartTooltipRow color="var(--gray-1000)" label="Net" value={formatPounds(point.net ?? 0, 1)} />
    </ChartTooltipCard>
  );
}

export function TradeChart({ rows }: { rows: TradeChartRow[] }) {
  return (
    <div className="min-w-0">
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="month" tickFormatter={formatMonth} minTickGap={24} tick={chartAxisTick} {...chartAxisLine} />
            <YAxis
              tickFormatter={(value: number) => formatPounds(value, 0)}
              width={64}
              tick={chartAxisTick}
              {...chartAxisLine}
            />
            <Tooltip content={<TradeTooltip />} wrapperStyle={{ zIndex: 30 }} />
            <Bar dataKey="imports" fill="var(--chart-imports)" isAnimationActive={false} />
            <Bar dataKey="exports" fill="var(--chart-wind)" isAnimationActive={false} />
            <Line dataKey="net" stroke="var(--gray-1000)" {...chartLine} />
          </ComposedChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      <ul className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-label-13 text-gray-900">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-imports)]" aria-hidden="true" />
          Imports
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-wind)]" aria-hidden="true" />
          Exports
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-gray-1000" aria-hidden="true" />
          Net, imports minus exports
        </li>
      </ul>
    </div>
  );
}
