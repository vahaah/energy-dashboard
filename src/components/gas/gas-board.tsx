"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { ChartBoundary } from "@/components/gas/chart-boundary";
import { DataStateNotice } from "@/components/ui/data-state";
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
import { selectGasSlice, type GasDocument, type GasShareRow, type GasSlice, type GasStat } from "@/lib/gas/view";

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
              value={slice.day}
              onChange={(event) => {
                void setParams({ day: event.target.value });
              }}
              className="h-8 rounded-md border border-gray-alpha-400 bg-background-100 px-2 text-label-13 text-gray-1000"
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
        <p className="text-mono-12 break-words text-gray-900">
          Data time{" "}
          <time data-clock="data" dateTime={slice.stamp.dataTime}>
            {slice.stamp.dataTimeLabel}
          </time>
          {" · Published "}
          <time data-clock="published" dateTime={slice.stamp.publishedAt}>
            {slice.stamp.publishedLabel}
          </time>
          {" · Retrieved "}
          <time data-clock="retrieved" dateTime={slice.stamp.retrievedAt}>
            {slice.stamp.retrievedLabel}
          </time>
        </p>
        {slice.staleText ? <p data-gas-stale>{slice.staleText}</p> : null}
        {slice.partialText ? <p data-gas-partial>{slice.partialText}</p> : null}
      </header>

      {slice.stats.map((stat) => (
        <div key={stat.id} className="col-span-6 lg:col-span-3">
          <StatCard stat={stat} />
        </div>
      ))}

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
          <ShareList rows={slice.demand} />
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-6">
        <Card title="Linepack">
          <p className="text-copy-14 text-gray-900">{slice.linepack.description}</p>
          <dl className="mt-4 flex flex-col gap-3">
            <Line label="Opening" value={slice.linepack.opening} unit={slice.linepack.unit} />
            <Line label="Current" value={slice.linepack.current} unit={slice.linepack.unit} />
            <Line label="Predicted close" value={slice.linepack.predictedClose} unit={slice.linepack.unit} />
            {slice.linepack.close ? <Line label="Close" value={slice.linepack.close} unit={slice.linepack.unit} /> : null}
          </dl>
        </Card>
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Card title="Storage">
          <dl className="flex flex-col gap-3">
            <Line label="Injection" value={slice.storage.injection} unit={slice.storage.unit} />
            <Line label="Withdrawal" value={slice.storage.withdrawal} unit={slice.storage.unit} />
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
          className={`inline-flex h-8 items-center rounded-md px-2 text-label-13 ${
            item === basis ? "bg-background-100 text-gray-1000" : "text-gray-900"
          }`}
        >
          {GAS_BASIS_LABEL[item]}
        </button>
      ))}
    </div>
  );
}

function StatCard({ stat }: { stat: GasStat }) {
  return (
    <Card size="stat" title={stat.title} className="h-full">
      {stat.state ? <DataStateNotice state={stat.state} /> : null}
      <p className="mt-2 font-sans text-heading-24 tabular-nums text-gray-1000">{stat.valueLabel}</p>
      <p className="text-label-13 text-gray-900">{stat.unit}</p>
      <p className="mt-2 text-label-12 text-gray-900">{stat.basisLabel}</p>
    </Card>
  );
}

function SeriesCard({ slice }: { slice: GasSlice }) {
  const [showTable, setShowTable] = useState(true);
  const showForecast = slice.series.some((point) => point.supplyForecast != null || point.demandForecast != null);
  return (
    <Card
      title="Supply and demand"
      footer={<p className="break-words">{slice.footer}</p>}
    >
      <div>
        <button
          type="button"
          aria-pressed={showTable}
          onClick={() => setShowTable((current) => !current)}
          className="inline-flex h-8 items-center text-label-13 text-gray-1000"
        >
          Show table
        </button>
        {showTable ? (
          <div className="mt-4 overflow-x-auto">
            <table data-gas-table className="w-full text-left text-copy-14">
              <thead>
                <tr className="text-label-12 text-gray-900">
                  <th className="py-2 pr-3 font-normal">Time</th>
                  <th className="py-2 pr-3 font-normal">Supply</th>
                  <th className="py-2 pr-3 font-normal">Demand</th>
                  {showForecast ? <th className="py-2 font-normal">Forecast</th> : null}
                </tr>
              </thead>
              <tbody>
                {slice.series.map((point) => (
                  <tr key={point.at}>
                    <td className="py-2 pr-3">{point.label}</td>
                    <td className="py-2 pr-3 tabular-nums">{quantityCell(point.supply)}</td>
                    <td className="py-2 pr-3 tabular-nums">{quantityCell(point.demand)}</td>
                    {showForecast ? (
                      <td className="py-2 tabular-nums">{quantityCell(point.supplyForecast ?? point.demandForecast)}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <ChartBoundary>
        <GasSeriesChart points={slice.series} now={slice.now} unit={seriesUnit(slice.basis)} />
      </ChartBoundary>
    </Card>
  );
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
            <p className="min-w-0 break-words text-copy-14 text-gray-1000">{row.label}</p>
            <p className="shrink-0 text-label-13 tabular-nums text-gray-1000">{row.percent}%</p>
          </div>
          <p className="text-mono-12 text-gray-900">{row.publicationId}</p>
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

function Line({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <dt className="text-copy-14 text-gray-900">{label}</dt>
      <dd className="text-copy-14 tabular-nums text-gray-1000">
        {value} {value === ABSENT_FIGURE ? null : unit}
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
