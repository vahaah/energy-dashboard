"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";
import {
  NESO_EMBEDDED_FORECAST_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
} from "@/lib/attribution";
import { EXPORT_GAP_COLOR, IMPORT_GAP_COLOR } from "@/lib/colors";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";
import { useElementWidth } from "@/components/charts/use-element-width";
import { DataStateNotice } from "@/components/ui/data-state";
import {
  DEMAND_FORECAST_EMBEDDED_BASIS,
  type DemandForecastBasis,
  type ForecastPoint,
} from "@/lib/forecast-model";
import {
  chartAnimation,
  chartAxisLine,
  chartAxisTick,
  chartGrid,
  chartHeroLine,
  chartLine,
  chartYAxisUnitLabel,
  CHART_HEIGHT_HERO,
} from "@/lib/chart-theme";
import {
  buildDemandBalanceSeries,
  formatEmbeddedMissingNote,
} from "@/lib/dashboard-model";
import {
  appendDemandForecastPoints,
  displayedDemandBalance,
  demandBalanceYTicks,
  demandChartMargin,
  demandChartTimeTicks,
  demandForecastStartMs,
  demandSeriesLabelLayout,
  forecastLabelLayout,
  formatDemandBalanceTickLines,
  formatDemandBalanceTooltipLabel,
  lastDefinedIndex,
  prepareDemandBalanceChartData,
  usesLongRangeSmoothing,
  withDemandChartTime,
  type DemandBalanceChartPoint,
  type DemandEndLabelLayout,
} from "@/lib/generation-desk-view";

interface Props {
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
  range: TimeRange;
  demandForecast?: ForecastPoint[];
  demandBasis?: DemandForecastBasis | null;
  now?: Date | null;
}

const SERIES_LABELS: Record<string, string> = {
  demandGw: "Demand (incl. embedded)",
  generationGw: "Generation (incl. embedded)",
  demandForecastGw: "Demand forecast",
};

const SERIES_COLORS: Record<string, string> = {
  demandGw: "var(--gray-1000)",
  generationGw: "var(--gray-900)",
  demandForecastGw: "var(--gray-700)",
};

const COMPACT_CHART_WIDTH = 480;

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
  const figures =
    point?.demandGw != null && point.generationGw != null
      ? displayedDemandBalance(point.demandGw, point.generationGw)
      : null;
  const gap = figures?.gapLabel ?? null;
  const series = payload.filter((entry) => {
    const key = String(entry.dataKey ?? entry.name ?? "");
    return key === "demandGw" || key === "generationGw" || key === "demandForecastGw";
  });

  return (
    <ChartTooltipCard time={formatDemandBalanceTooltipLabel(label, range)}>
      {series.map((entry) => {
        if (entry.value == null) {
          return null;
        }

        const key = String(entry.dataKey ?? entry.name ?? "");
        let daily: number | null = null;
        if (key === "demandGw") {
          daily = point?.demandDailyGw ?? null;
        } else if (key === "generationGw") {
          daily = point?.generationDailyGw ?? null;
        }
        const shown =
          key === "demandGw" && figures
            ? figures.demand
            : key === "generationGw" && figures
              ? figures.generation
              : Number(entry.value).toFixed(1);
        return (
          <ChartTooltipRow
            key={key}
            color={SERIES_COLORS[key] ?? "var(--gray-1000)"}
            label={SERIES_LABELS[key] ?? key}
            value={daily == null ? `${shown} GW` : `${shown} GW · daily ${daily.toFixed(1)} GW`}
          />
        );
      })}
      {gap ? <p className="text-gray-900">{gap}</p> : null}
      {note ? <p className="mt-1 text-amber-700">{note}</p> : null}
    </ChartTooltipCard>
  );
}

export function DemandBalanceChart({
  snapshots,
  generation,
  range,
  demandForecast = [],
  demandBasis = null,
  now = null,
}: Props) {
  const { ref, width } = useElementWidth();
  const compact = width === 0 || width < COMPACT_CHART_WIDTH;
  const series = buildDemandBalanceSeries(snapshots, generation, range);
  const chartData = withDemandChartTime(
    appendDemandForecastPoints(prepareDemandBalanceChartData(series, range), demandForecast)
  );
  const smoothed = usesLongRangeSmoothing(range);
  const yTicks = demandBalanceYTicks(chartData);
  const datedDayTicks = demandForecast.length > 0;
  const xTicks = demandChartTimeTicks(
    chartData.map((point) => point.ts),
    compact
  );
  const demandLabelIndex = lastDefinedIndex(chartData, "demandGw");
  const generationLabelIndex = lastDefinedIndex(chartData, "generationGw");
  const forecastLabelIndex = lastDefinedIndex(chartData, "demandForecastGw");
  const nowX = now?.getTime() ?? null;
  const forecastStartX = demandForecastStartMs(chartData);
  const lastTs = chartData.at(-1)?.ts;
  const domain: [number, number] | undefined =
    chartData[0] && lastTs != null ? [chartData[0].ts, lastTs] : undefined;
  const yMax = yTicks.at(-1) ?? 40;
  const seriesLabels = demandSeriesLabelLayout(
    chartData[demandLabelIndex]?.demandGw,
    chartData[generationLabelIndex]?.generationGw
  );
  const forecastLabel = forecastLabelLayout(compact);
  const plotMargin = demandChartMargin(compact, datedDayTicks, demandForecast.length > 0);
  const lifted = demandBasis === DEMAND_FORECAST_EMBEDDED_BASIS;

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <GapKey />
        {demandForecast.length > 0 ? <DataStateNotice state="forecast" /> : null}
      </div>
      <ResponsiveChartFrame className={CHART_HEIGHT_HERO}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={plotMargin}>
            <CartesianGrid {...chartGrid} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={domain ?? ["dataMin", "dataMax"]}
              ticks={xTicks}
              interval={0}
              minTickGap={compact ? 64 : 24}
              tick={(props) => (
                <DemandBalanceXTick
                  x={props.x}
                  y={props.y}
                  payload={props.payload}
                  range={range}
                  includeDate={datedDayTicks}
                  compact={compact}
                />
              )}
              {...chartAxisLine}
            />
            <YAxis
              domain={[0, yMax]}
              ticks={yTicks}
              tickFormatter={(value: number) => Number(value).toFixed(1)}
              tick={chartAxisTick}
              {...chartAxisLine}
              width={44}
              label={{
                value: "GW",
                ...chartYAxisUnitLabel,
              }}
            />
            <Tooltip
              cursor={{ stroke: "var(--gray-alpha-400)", strokeWidth: 1 }}
              content={<DemandBalanceTooltip range={range} />}
              wrapperStyle={{ zIndex: 320 }}
            />
            {forecastStartX != null && lastTs != null ? (
              <ReferenceArea
                x1={forecastStartX}
                x2={lastTs}
                fill="var(--gray-alpha-100)"
                strokeOpacity={0}
              />
            ) : null}
            <ReferenceLine y={0} stroke="var(--gray-alpha-200)" />
            {nowX ? (
              <ReferenceLine
                x={nowX}
                stroke="var(--gray-700)"
                strokeDasharray="4 4"
                label={{
                  value: "Now",
                  position: "insideTopLeft",
                  fill: "var(--gray-700)",
                  fontSize: 12,
                }}
              />
            ) : null}
            {forecastStartX != null ? (
              <ReferenceLine
                x={forecastStartX}
                stroke="var(--gray-700)"
                strokeDasharray="2 4"
                label={{
                  value: "Forecast starts",
                  position: "insideTopLeft",
                  fill: "var(--gray-700)",
                  fontSize: 12,
                }}
              />
            ) : null}
            {smoothed ? (
              <Line
                type="monotone"
                dataKey="demandDailyGw"
                stroke="transparent"
                strokeWidth={0}
                dot={{ r: 1.5, fill: "var(--gray-1000)", fillOpacity: 0.28 }}
                legendType="none"
                tooltipType="none"
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
            {smoothed ? (
              <Line
                type="monotone"
                dataKey="generationDailyGw"
                stroke="transparent"
                strokeWidth={0}
                dot={{ r: 1.5, fill: "var(--gray-900)", fillOpacity: 0.28 }}
                legendType="none"
                tooltipType="none"
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
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
              dataKey="demandForecastGw"
              stroke="var(--gray-700)"
              strokeDasharray="4 4"
              name="Demand forecast"
              {...chartLine}
              {...chartAnimation}
            >
              <LabelList
                dataKey="demandForecastGw"
                content={(props) => {
                  const raw = props.value;
                  return endLineLabel({
                    index: props.index,
                    x: props.x,
                    y: props.y,
                    value: typeof raw === "number" || typeof raw === "string" ? raw : undefined,
                    targetIndex: forecastLabelIndex,
                    text: "Forecast",
                    color: "var(--gray-700)",
                    layout: forecastLabel,
                  });
                }}
              />
            </Line>
            <Line
              type="monotone"
              dataKey="demandGw"
              stroke="var(--gray-1000)"
              name="Demand (incl. embedded)"
              {...chartHeroLine}
              {...chartAnimation}
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
                    color: "var(--gray-1000)",
                    layout: seriesLabels.demand,
                  });
                }}
              />
            </Line>
            <Line
              type="monotone"
              dataKey="generationGw"
              stroke="var(--gray-900)"
              name="Generation (incl. embedded)"
              {...chartLine}
              {...chartAnimation}
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
                    color: "var(--gray-900)",
                    layout: seriesLabels.generation,
                  });
                }}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </ResponsiveChartFrame>
      {smoothed ? (
        <p className="text-xs font-medium text-gray-1000">
          Lines are 7-day averages; dots are daily values.
        </p>
      ) : null}
      {demandForecast.length > 0 ? (
        <p className="text-label-12 text-gray-900">
          {lifted ? (
            <>
              Dashed line continues demand including embedded: Elexon NDF plus{" "}
              <a
                href={NESO_EMBEDDED_FORECAST_URL}
                className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
              >
                NESO embedded wind and solar forecast
              </a>
              . {NESO_OPEN_DATA_ATTRIBUTION}. The blank stretch is the day-ahead gap.
            </>
          ) : (
            "Dashed line is Elexon’s National Demand Forecast (transmission, excludes embedded)."
          )}
        </p>
      ) : null}
      {compact ? <SeriesKey showForecast={demandForecast.length > 0} /> : null}
    </div>
  );
}

function GapKey() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-1000">
      <li className="inline-flex items-center gap-1.5">
        <span
          className="h-2 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: EXPORT_GAP_COLOR }}
          aria-hidden="true"
        />
        Exports (generation above demand)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          className="h-2 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: IMPORT_GAP_COLOR }}
          aria-hidden="true"
        />
        Imports (demand above generation)
      </li>
    </ul>
  );
}

function SeriesKey({ showForecast }: { showForecast: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-1000">
      <li className="inline-flex items-center gap-1.5">
        <span
          className="h-0.5 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: "var(--gray-1000)" }}
          aria-hidden="true"
        />
        Demand
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          className="h-0.5 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: "var(--gray-900)" }}
          aria-hidden="true"
        />
        Generation
      </li>
      {showForecast ? (
        <li className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-3 shrink-0 border-t border-dashed border-gray-700"
            aria-hidden="true"
          />
          Demand forecast
        </li>
      ) : null}
    </ul>
  );
}

function DemandBalanceXTick({
  x,
  y,
  payload,
  range,
  includeDate,
  compact,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
  range: TimeRange;
  includeDate: boolean;
  compact: boolean;
}) {
  if (x == null || y == null || payload?.value == null) {
    return null;
  }

  const lines = formatDemandBalanceTickLines(payload.value, range, {
    includeDate,
    compact,
  });

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

function endLineLabel({
  index,
  x,
  y,
  value,
  targetIndex,
  text,
  color,
  layout,
}: {
  index?: number;
  x?: number | string;
  y?: number | string;
  value?: number | string;
  targetIndex: number;
  text: string;
  color: string;
  layout: DemandEndLabelLayout;
}) {
  if (index !== targetIndex || value == null || x == null || y == null) {
    return null;
  }

  return (
    <text
      x={Number(x) + layout.xOffset}
      y={Number(y) + layout.yOffset}
      fill={color}
      fontSize={12}
      textAnchor={layout.textAnchor}
      dominantBaseline="middle"
    >
      {text}
    </text>
  );
}
