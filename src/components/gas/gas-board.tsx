"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { ChartBoundary } from "@/components/gas/chart-boundary";
import { DataStateNotice } from "@/components/ui/data-state";
import { Freshness } from "@/components/ui/freshness";
import { Card } from "@/components/ui/card";
import { ABSENT_FIGURE } from "@/lib/data-state";
import { formatDisplay } from "@/lib/display-rounding";
import {
  GAS_ATTRIBUTION,
  GAS_BASIS_LABEL,
  GAS_COVERAGE_HREF,
  GAS_COVERAGE_LABEL,
  GAS_LINEPACK_DESCRIPTION,
  GAS_PAGE_BASES,
  GAS_PRICES_HREF,
  GAS_PRICES_LABEL,
  GAS_SAP_DEFINITION,
  GAS_SCOPE,
  GAS_UNIT_DAY,
  GAS_UNIT_STOCK,
  type GasPageBasis,
} from "@/lib/gas/copy";
import {
  selectGasSlice,
  type GasComparisonRow,
  type GasDocument,
  type GasShareRow,
  type GasSlice,
  type GasStat,
} from "@/lib/gas/view";

const GasSeriesChart = dynamic(
  () => import("@/components/gas/gas-series-chart").then((mod) => mod.GasSeriesChart),
  { ssr: false, loading: () => null },
);

const gasParsers = {
  day: parseAsString,
  basis: parseAsStringLiteral(GAS_PAGE_BASES),
};

const CHIP =
  "inline-flex max-w-full items-center rounded-md border border-gray-alpha-400 px-1.5 py-0.5 text-label-12 text-gray-900";

export function GasBoard({ document }: { document: Extract<GasDocument, { available: true }> }) {
  const [params, setParams] = useQueryStates(gasParsers, { history: "replace", shallow: true, scroll: false });
  const slice = selectGasSlice(document, params.day, params.basis);

  return (
    <div className="grid grid-cols-12 gap-4" data-gas-day-state={slice.state} data-gas-basis={slice.basis}>
      <header className="col-span-12 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-label-13 text-gray-1000">
            <span className="sr-only">Gas day</span>
            <select
              name="gas-day"
              autoComplete="off"
              value={slice.day}
              onChange={(event) => {
                void setParams({ day: event.target.value });
              }}
              className="h-11 min-h-11 rounded-md border border-gray-alpha-400 bg-background-100 px-2 text-label-13 text-gray-1000 sm:h-8 sm:min-h-8"
            >
              {document.days.map((day) => (
                <option key={day.label} value={day.label}>
                  {day.text}
                </option>
              ))}
            </select>
          </label>
          <BasisControl
            bases={slice.bases}
            basis={slice.basis}
            onChange={(basis) => {
              void setParams({ basis });
            }}
          />
          <span className={CHIP}>{GAS_SCOPE}</span>
          <Link href={GAS_COVERAGE_HREF} className={`${CHIP} text-blue-700 underline-offset-2 hover:underline`}>
            {GAS_COVERAGE_LABEL}
          </Link>
          <Link href={GAS_PRICES_HREF} className="text-label-13 text-blue-700 underline-offset-2 hover:underline">
            {GAS_PRICES_LABEL}
          </Link>
        </div>
        <p className="text-copy-14 text-gray-1000">{slice.dayLabel}</p>
        <Freshness
          state={slice.staleText ? "stale" : slice.partialText ? "partial" : "current"}
          asOf={slice.stamp.publishedLabel}
          asOfDateTime={slice.stamp.publishedAt}
          detail={
            slice.staleText || slice.partialText ? (
              <>
                {slice.staleText ? <span data-gas-stale>{slice.staleText}</span> : null}
                {slice.staleText && slice.partialText ? " " : null}
                {slice.partialText ? <span data-gas-partial>{slice.partialText}</span> : null}
              </>
            ) : null
          }
        />
      </header>

      <div className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {slice.stats.map((stat) => (
          <StatCard
            key={stat.id}
            stat={stat}
            partialReason={slice.partialText}
            suppressPartial={suppressPartialBadges(slice)}
          />
        ))}
      </div>

      <div className="col-span-12">
        <SeriesCard slice={slice} />
      </div>

      <div className="col-span-12 lg:col-span-6">
        <Card title="Entry points">
          <ShareList rows={slice.entry} />
        </Card>
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Card title="Demand">
          {slice.demandAsOfLabel ? (
            <p className="mb-3 text-label-12 text-gray-900">{`${GAS_BASIS_LABEL.completed}, ${slice.demandAsOfLabel}`}</p>
          ) : null}
          <ShareList rows={slice.demand} />
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-6">
        <Card title="Linepack">
          <p className="text-copy-14 text-gray-900">{slice.linepack.description}</p>
          <dl className="mt-4 flex flex-col gap-3">
            <Line label="Opening" value={slice.linepack.opening} unit={slice.linepack.unit} asOf={slice.linepack.openingAsOf} />
            <Line label="Current" value={slice.linepack.current} unit={slice.linepack.unit} asOf={slice.linepack.currentAsOf} />
            <Line
              label="Predicted close"
              value={slice.linepack.predictedClose}
              unit={slice.linepack.unit}
              asOf={slice.linepack.predictedCloseAsOf}
            />
            {slice.linepack.close ? (
              <Line label="Close" value={slice.linepack.close} unit={slice.linepack.unit} asOf={slice.linepack.closeAsOf} />
            ) : null}
          </dl>
        </Card>
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Card title="Storage">
          <dl className="flex flex-col gap-3">
            <Line
              label="Injection"
              value={slice.storage.injection}
              unit={slice.storage.unit}
              asOf={slice.storage.injectionAsOf}
            />
            <Line
              label="Withdrawal"
              value={slice.storage.withdrawal}
              unit={slice.storage.unit}
              asOf={slice.storage.withdrawalAsOf}
            />
          </dl>
          <p className="mt-4 break-words text-copy-14 text-gray-900">{slice.storage.notice}</p>
        </Card>
      </div>

      {slice.bridge ? (
        <>
          <div className="col-span-12 lg:col-span-6">
            <Card title="Power-station offtake">
              <BridgeFigure
                value={slice.bridge.offtake.valueLabel}
                unit={slice.bridge.offtake.unit}
                at={slice.bridge.offtake.at}
                atLabel={slice.bridge.offtake.atLabel}
                period={slice.bridge.period}
              />
            </Card>
          </div>
          <div className="col-span-12 lg:col-span-6">
            <Card title="Gas generation">
              <BridgeFigure
                value={slice.bridge.generation.valueLabel}
                unit={slice.bridge.generation.unit}
                at={slice.bridge.generation.at}
                atLabel={slice.bridge.generation.atLabel}
                period={slice.bridge.period}
              />
            </Card>
          </div>
        </>
      ) : null}

      <div className="col-span-12">
        <Card title="Comparison with recent days">
          {slice.comparison.length === 0 ? (
            <p className="text-copy-14 text-gray-900">No other gas day is published on this basis.</p>
          ) : slice.comparison.length === 1 && slice.comparison[0] ? (
            <ComparisonSentence row={slice.comparison[0]} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-0 text-left text-copy-14">
                <thead>
                  <tr className="text-label-12 text-gray-900">
                    <th className="py-2 pr-3 font-normal">Gas day</th>
                    <th className="py-2 pr-3 font-normal">Basis</th>
                    <th className="py-2 pr-3 font-normal">State</th>
                    <th className="py-2 pr-3 font-normal">Supply</th>
                    <th className="py-2 font-normal">Demand</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.comparison.map((row) => (
                    <tr key={`${row.day}-${row.basis}`} data-comparison-basis={row.basis} data-comparison-state={row.state}>
                      <td className="py-2 pr-3">{row.dayLabel}</td>
                      <td className="py-2 pr-3">{GAS_BASIS_LABEL[row.basis]}</td>
                      <td className="py-2 pr-3">{row.state === "partial" ? "Partial" : "Complete"}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.supply}</td>
                      <td className="py-2 tabular-nums">{row.demand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="col-span-12">
        <Card title="Sources and definitions">
          <div className="flex flex-col gap-3 text-copy-14 text-gray-900">
            <p>{GAS_ATTRIBUTION}</p>
            <p>
              <Link href={GAS_PRICES_HREF} className="text-blue-700 underline-offset-2 hover:underline">
                {GAS_SAP_DEFINITION}
              </Link>
            </p>
            <p>{GAS_LINEPACK_DESCRIPTION}. A gas day runs 05:00–05:00 Europe/London.</p>
            <ul className="flex flex-col gap-1">
              {GAS_PAGE_BASES.filter((basis) => document.slices.some((item) => item.bases.includes(basis))).map((basis) => (
                <li key={basis}>{GAS_BASIS_LABEL[basis]}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BasisControl({
  bases,
  basis,
  onChange,
}: {
  bases: readonly GasPageBasis[];
  basis: GasPageBasis;
  onChange: (basis: GasPageBasis) => void;
}) {
  if (bases.length <= 1) {
    return <p data-basis-label>{GAS_BASIS_LABEL[basis]}</p>;
  }
  return (
    <div className="inline-flex flex-wrap rounded-md border border-gray-alpha-400 bg-background-200" role="group" aria-label="Basis">
      {bases.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === basis}
          onClick={() => onChange(item)}
          className={`inline-flex h-11 min-h-11 items-center rounded-md px-2 text-label-13 sm:h-8 sm:min-h-8 ${
            item === basis ? "bg-background-100 text-gray-1000" : "text-gray-900"
          }`}
        >
          {GAS_BASIS_LABEL[item]}
        </button>
      ))}
    </div>
  );
}

function suppressPartialBadges(slice: GasSlice): boolean {
  const partial = slice.stats.filter((stat) => stat.state === "partial").length;
  const other = slice.stats.some((stat) => stat.state != null && stat.state !== "partial");
  return partial > 0 && !other && slice.partialText != null;
}

function StatCard({
  stat,
  partialReason,
  suppressPartial,
}: {
  stat: GasStat;
  partialReason: string | null;
  suppressPartial: boolean;
}) {
  const absent = stat.valueLabel === ABSENT_FIGURE;
  const basis = stat.asOfLabel ? `${GAS_BASIS_LABEL.completed}, ${stat.asOfLabel}` : stat.basisLabel;
  const partial = stat.state === "partial";
  const showNotice = stat.state != null && !(partial && suppressPartial);
  return (
    <Card
      size="stat"
      title={stat.title}
      className="h-full min-w-0"
      tooltip={partial && !suppressPartial && partialReason ? partialReason : undefined}
    >
      {showNotice && stat.state ? <DataStateNotice state={stat.state} /> : null}
      {absent ? null : <p className="mt-2 font-sans text-heading-24 tabular-nums text-gray-1000">{stat.valueLabel}</p>}
      {absent ? null : <p className="text-label-13 text-gray-900">{stat.unit}</p>}
      <p className="mt-2 text-label-13 text-gray-900">{basis}</p>
    </Card>
  );
}

const GAS_TABLE_PREVIEW = 25;

function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function SeriesCard({ slice }: { slice: GasSlice }) {
  const hydrated = useHydrated();
  const [opened, setOpened] = useState(false);
  const showTable = !hydrated || opened;
  const showForecast = slice.series.some((point) => point.supplyForecast != null || point.demandForecast != null);
  const showDemand = slice.series.some((point) => point.demand != null);
  return (
    <Card
      title="Supply and demand"
      footer={<p className="break-words">{slice.footer}</p>}
    >
      <p className="text-copy-14 text-gray-900">
        {seriesUnit(slice.basis)}, as of {slice.stamp.publishedLabel}.
      </p>
      <ChartBoundary>
        <GasSeriesChart points={slice.series} now={slice.now} unit={seriesUnit(slice.basis)} />
      </ChartBoundary>
      <div className="mt-4">
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls="gas-series-table"
          onClick={() => setOpened((current) => !current)}
          className="inline-flex min-h-11 items-center text-label-13 text-gray-1000"
        >
          {showTable ? "Hide table" : "Show table"}
        </button>
        {showTable ? (
          <div id="gas-series-table" className="mt-4 overflow-x-auto">
            <GasSeriesTable series={slice.series} showDemand={showDemand} showForecast={showForecast} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function GasSeriesTable({
  series,
  showDemand,
  showForecast,
}: {
  series: GasSlice["series"];
  showDemand: boolean;
  showForecast: boolean;
}) {
  const preview = series.slice(0, GAS_TABLE_PREVIEW);
  const remainder = series.slice(GAS_TABLE_PREVIEW);
  return (
    <>
      <table data-gas-table className="w-full text-left text-copy-14">
        <thead>
          <tr className="text-label-12 text-gray-900">
            <th className="py-2 pr-3 font-normal">Time</th>
            <th className="py-2 pr-3 font-normal">Supply</th>
            {showDemand ? <th className="py-2 pr-3 font-normal">Demand</th> : null}
            {showForecast ? <th className="py-2 font-normal">Forecast</th> : null}
          </tr>
        </thead>
        <tbody>
          <SeriesRows points={preview} showDemand={showDemand} showForecast={showForecast} />
        </tbody>
      </table>
      {remainder.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-copy-14 text-gray-1000">Show all {series.length} rows</summary>
          <table className="mt-3 w-full text-left text-copy-14">
            <tbody>
              <SeriesRows points={remainder} showDemand={showDemand} showForecast={showForecast} />
            </tbody>
          </table>
        </details>
      ) : null}
    </>
  );
}

function SeriesRows({
  points,
  showDemand,
  showForecast,
}: {
  points: GasSlice["series"];
  showDemand: boolean;
  showForecast: boolean;
}) {
  return points.map((point) => (
    <tr key={point.at}>
      <td className="py-2 pr-3">{point.label}</td>
      <td className="py-2 pr-3 tabular-nums">{quantityCell(point.supply)}</td>
      {showDemand ? <td className="py-2 pr-3 tabular-nums">{quantityCell(point.demand)}</td> : null}
      {showForecast ? (
        <td className="py-2 tabular-nums">{quantityCell(point.supplyForecast ?? point.demandForecast)}</td>
      ) : null}
    </tr>
  ));
}

function ShareList({ rows }: { rows: readonly GasShareRow[] }) {
  if (rows.length === 0) {
    return <DataStateNotice state="not_yet_available" />;
  }
  return (
    <ul className="flex min-w-0 flex-col gap-4">
      {rows.map((row) => (
        <li key={row.publicationId} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 break-words text-copy-14 text-gray-1000" title={row.publicationId}>
              {row.label}
            </p>
            <p className="shrink-0 text-label-13 tabular-nums text-gray-1000">{row.percent}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-gray-200">
            <div className="h-2 rounded-sm bg-gray-1000" style={{ width: `${row.percent}%`, opacity: 0.85 }} />
          </div>
          <p className="mt-1 text-label-12 text-gray-900">
            {row.valueLabel} {row.unit}
          </p>
          {row.note ? <p className="mt-1 break-words text-label-12 text-gray-900">{row.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function Line({ label, value, unit, asOf }: { label: string; value: string; unit: string; asOf: string | null }) {
  if (value === ABSENT_FIGURE) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <dt className="text-copy-14 text-gray-900">{label}</dt>
      <dd className="text-copy-14 tabular-nums text-gray-1000">
        {value} {unit}
        {asOf ? <span className="text-gray-900">{` · ${asOf}`}</span> : null}
      </dd>
    </div>
  );
}

function BridgeFigure({
  value,
  unit,
  at,
  atLabel,
  period,
}: {
  value: string;
  unit: string;
  at: string;
  atLabel: string;
  period: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-sans text-heading-24 tabular-nums text-gray-1000">{value}</p>
      <p className="text-label-13 text-gray-900">{unit}</p>
      <p className="break-words text-copy-14 text-gray-900">{period}</p>
      <p className="text-mono-12 break-words text-gray-900">
        <time dateTime={at}>{atLabel}</time>
      </p>
    </div>
  );
}

function ComparisonSentence({ row }: { row: GasComparisonRow }) {
  const state = row.state === "partial" ? "partial" : "complete";
  return (
    <p className="text-copy-14 text-gray-1000" data-comparison-basis={row.basis} data-comparison-state={row.state}>
      {row.dayLabel} was {state}, with supply {row.supply} and demand {row.demand}, on a {GAS_BASIS_LABEL[row.basis]}{" "}
      basis.
    </p>
  );
}

function seriesUnit(basis: GasPageBasis): string {
  switch (basis) {
    case "flow":
      return GAS_UNIT_DAY;
    case "to-date":
    case "completed":
      return GAS_UNIT_STOCK;
    default: {
      const exhaustive: never = basis;
      return exhaustive;
    }
  }
}

function quantityCell(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return ABSENT_FIGURE;
  }
  return formatDisplay(value, 0.1);
}
