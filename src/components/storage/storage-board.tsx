"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { DataStateNotice } from "@/components/ui/data-state";
import { Card } from "@/components/ui/card";
import { Quantity } from "@/components/ui/quantity";
import { Absent } from "@/components/ui/absent";
import { NOT_AVAILABLE } from "@/lib/assets/labels";
import { formatEnergy, formatGrouped } from "@/lib/format/quantity";
import {
  CHARGING,
  COVERAGE_HREF,
  DISCHARGING,
  DURATION_TOOLTIP,
  ENERGY_CAPACITY,
  INVENTORY_HEADING,
  INVENTORY_INTRO,
  MONITORED_HEADING,
  MONITORED_INTRO,
  NOMINAL_DURATION,
  RATED_CAPACITY,
  SOURCES_HREF,
  STORAGE_SIGN,
} from "@/lib/storage/copy";
import type {
  StorageCoverageLine,
  StorageDocument,
  StorageMagnitude,
  StorageRow,
  StorageShare,
} from "@/lib/storage/page-model";

export function StorageBoard({ document }: { document: StorageDocument }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className={document.showEnergy ? "col-span-12 sm:col-span-6" : "col-span-12"}>
        <Card size="stat" title={RATED_CAPACITY} className="h-full">
          <StatValue
            value={document.rated?.totalLabel ?? NOT_AVAILABLE}
            unit={document.rated ? "MW" : null}
          />
          {document.rated && document.rated.omitted > 0 ? (
            <p className="mt-2 break-words text-label-12 text-gray-900">
              {document.rated.omitted} operating records do not publish a rated capacity and are left out of this
              total.
            </p>
          ) : null}
        </Card>
      </div>
      {document.energy ? (
        <div className="col-span-12 sm:col-span-6">
          <Card size="stat" title={ENERGY_CAPACITY} className="h-full">
            <StatValue value={document.energy.totalLabel} unit="MWh" />
          </Card>
        </div>
      ) : null}
      <div className="col-span-12">
        <Card size="stat" title={document.coverage.label} className="h-full">
          <Coverage coverage={document.coverage} />
        </Card>
      </div>

      <div className="col-span-12">
        <Card title={INVENTORY_HEADING} footer={<p className="break-words">{document.inventoryAttribution}</p>}>
          <p className="break-words text-copy-14 text-gray-900">{INVENTORY_INTRO}</p>
          {document.notOperatingCount > 0 ? (
            <p className="mt-3 break-words text-copy-14 text-gray-900">
              {formatGrouped(document.notOperatingCount, 0)} records are not operating and are left out of the operating total.
            </p>
          ) : null}
          <ShareList shares={document.rated?.shares ?? []} unit="MW" />
          {document.showDuration ? (
            <p className="mt-4 flex flex-wrap items-center gap-1 text-label-12 text-gray-900 md:hidden">
              {NOMINAL_DURATION}
              <InfoTooltip text={DURATION_TOOLTIP} label={`What is ${NOMINAL_DURATION}?`} />
            </p>
          ) : null}
          <InventoryTable rows={document.rows} showEnergy={document.showEnergy} showDuration={document.showDuration} />
          {document.energyNote ? (
            <p className="mt-4 break-words text-copy-14 text-gray-900">{document.energyNote}</p>
          ) : null}
        </Card>
      </div>

      <div className="col-span-12">
        <Card title={MONITORED_HEADING} footer={<p className="break-words">{document.monitoredAttribution}</p>}>
          <p className="break-words text-copy-14 text-gray-900">{MONITORED_INTRO}</p>
          <p className="mt-3 break-words text-copy-14 text-gray-900">{STORAGE_SIGN}</p>
          {document.monitored.available ? (
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Magnitude title={DISCHARGING} block={document.monitored.discharge} periodLabel={document.monitored.periodLabel} periodStart={document.monitored.periodStart} />
                <Magnitude title={CHARGING} block={document.monitored.charge} periodLabel={document.monitored.periodLabel} periodStart={document.monitored.periodStart} />
              </div>
              {document.monitored.discharge.unreported.map((text) => (
                <p key={text} className="mt-3 break-words text-copy-14 text-gray-900">
                  {text}
                </p>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <DataStateNotice state="not_yet_available" />
            </div>
          )}
        </Card>
      </div>

      <div className="col-span-12">
        <Card title="Sources">
          <p className="break-words text-copy-14 text-gray-900">
            <Link href={SOURCES_HREF} className="text-blue-700 underline-offset-2 hover:underline">
              Data sources
            </Link>
            {" · "}
            <Link href={COVERAGE_HREF} className="text-blue-700 underline-offset-2 hover:underline">
              Data health
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

function StatValue({ value, unit }: { value: string; unit: string | null }) {
  const parsed = Number(value.replaceAll(",", ""));
  if (unit === "MW" && value !== NOT_AVAILABLE && Number.isFinite(parsed)) {
    const energy = formatEnergy(parsed);
    return (
      <p className="mt-2 text-heading-24 text-gray-1000">
        <Quantity value={energy.value} unit={energy.unit} />
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
      <span className="font-sans text-heading-24 tabular-nums text-gray-1000">{value}</span>
      {unit && value !== NOT_AVAILABLE ? <span className="unit-label text-gray-900">{unit}</span> : null}
    </p>
  );
}

function Coverage({ coverage }: { coverage: StorageDocument["coverage"] }) {
  return (
    <div className="mt-2">
      {coverage.nationalOnly ? (
        <p className="break-words text-copy-14 text-gray-1000">{coverage.nationalOnly}</p>
      ) : null}
      {coverage.lines.length > 0 ? (
        <ul className={`flex flex-col gap-3 ${coverage.nationalOnly ? "mt-3" : ""}`}>
          {coverage.lines.map((line) => (
            <CoverageLine key={line.id} line={line} />
          ))}
        </ul>
      ) : null}
      {coverage.footnote ? <p className="mt-3 break-words text-label-12 text-gray-900">{coverage.footnote}</p> : null}
    </div>
  );
}

function CoverageLine({ line }: { line: StorageCoverageLine }) {
  switch (line.kind) {
    case "mw":
      return (
        <li>
          <p className="break-words text-copy-14 text-gray-900">{line.label}</p>
          <p className="mt-1 break-words font-sans text-heading-24 tabular-nums text-gray-1000">
            {reportingPercent(line.coveredLabel, line.totalLabel)}% of capacity reporting
          </p>
          <p className="mt-1 break-words text-copy-14 text-gray-900">
            {line.coveredLabel} of {line.totalLabel} MW monitored
          </p>
        </li>
      );
    case "unreported":
      return (
        <li>
          <p className="break-words text-copy-14 text-gray-1000">{line.text}</p>
        </li>
      );
    default: {
      const exhaustive: never = line;
      return exhaustive;
    }
  }
}

function ShareList({ shares, unit }: { shares: readonly StorageShare[]; unit: string }) {
  if (!shares || shares.length === 0) {
    return null;
  }
  return (
    <ul className="mt-4 flex min-w-0 flex-col gap-4">
      {shares.map((share) => (
        <li key={share.technology} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 break-words text-copy-14 text-gray-1000">{share.label}</p>
            <p className="shrink-0 text-label-13 tabular-nums text-gray-1000">{share.percent}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-gray-200">
            <div
              className="h-2 rounded-sm"
              style={{ width: `${share.percent}%`, backgroundColor: storageColor(share.technology) }}
            />
          </div>
          <p className="mt-1 text-label-12 text-gray-900">
            {share.mwLabel} {unit}
          </p>
        </li>
      ))}
    </ul>
  );
}

const TABLE_GRID = {
  rated: "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)]",
  energy: "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]",
  duration: "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_repeat(3,minmax(0,1fr))]",
} as const;

function tableGrid(showEnergy: boolean, showDuration: boolean): string {
  if (showDuration) {
    return TABLE_GRID.duration;
  }
  if (showEnergy) {
    return TABLE_GRID.energy;
  }
  return TABLE_GRID.rated;
}

const STATION_PREVIEW = 25;

function InventoryTable({
  rows,
  showEnergy,
  showDuration,
}: {
  rows: readonly StorageRow[];
  showEnergy: boolean;
  showDuration: boolean;
}) {
  const [technology, setTechnology] = useState("all");
  const [status, setStatus] = useState("all");
  const technologies = useMemo(() => [...new Set(rows.map((row) => row.technologyLabel))].sort(), [rows]);
  const filtered = rows.filter((row) => {
    if (technology !== "all" && row.technologyLabel !== technology) {
      return false;
    }
    if (status !== "all" && status !== "operational") {
      return false;
    }
    return true;
  });
  const grid = tableGrid(showEnergy, showDuration);
  const preview = filtered.slice(0, STATION_PREVIEW);
  const remainder = filtered.slice(STATION_PREVIEW);
  return (
    <div className="mt-4">
      <div className="mb-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
          Type
          <select
            name="storage-type"
            autoComplete="off"
            value={technology}
            onChange={(event) => setTechnology(event.target.value)}
            className="h-11 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
          >
            <option value="all">All types</option>
            {technologies.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
          Status
          <select
            name="storage-status"
            autoComplete="off"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
          >
            <option value="all">All statuses</option>
            <option value="operational">Operational</option>
          </select>
        </label>
      </div>
      <div className={`hidden min-w-0 ${grid} gap-3 border-b border-gray-alpha-400 py-2 text-label-12 text-gray-900 md:grid`}>
        <p className="min-w-0 break-words">Station</p>
        <p className="min-w-0 break-words">Technology</p>
        <p className="min-w-0 break-words">{RATED_CAPACITY} (MW)</p>
        {showEnergy ? <p className="min-w-0 break-words">{ENERGY_CAPACITY} (MWh)</p> : null}
        {showDuration ? (
          <p className="flex min-w-0 flex-wrap items-center gap-1 break-words">
            {NOMINAL_DURATION}
            <InfoTooltip text={DURATION_TOOLTIP} label={`What is ${NOMINAL_DURATION}?`} align="end" />
          </p>
        ) : null}
      </div>
      <StationRows rows={preview} grid={grid} showEnergy={showEnergy} showDuration={showDuration} />
      {remainder.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-copy-14 text-gray-1000">
            Show all {filtered.length} stations
          </summary>
          <StationRows rows={remainder} grid={grid} showEnergy={showEnergy} showDuration={showDuration} />
        </details>
      ) : null}
    </div>
  );
}

function StationRows({
  rows,
  grid,
  showEnergy,
  showDuration,
}: {
  rows: readonly StorageRow[];
  grid: string;
  showEnergy: boolean;
  showDuration: boolean;
}) {
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id} className={`grid grid-cols-1 gap-1 border-b border-gray-alpha-400 py-3 ${grid} md:gap-3`}>
          <p className="min-w-0 break-words text-copy-14 text-gray-1000">
            {row.href ? (
              <Link href={row.href} className="inline-flex min-h-11 items-center gap-2 text-gray-1000 underline-offset-2 hover:bg-background-200 hover:underline focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none">
                {row.name}
                <span aria-hidden="true" className="text-gray-900">›</span>
              </Link>
            ) : (
              row.name
            )}
          </p>
          <Field label="Technology" value={row.technologyLabel} />
          <Field label={`${RATED_CAPACITY} (MW)`} value={row.ratedLabel} numeric />
          {showEnergy ? <OptionalField label={`${ENERGY_CAPACITY} (MWh)`} value={row.energyLabel} /> : null}
          {showDuration ? <OptionalField label={NOMINAL_DURATION} value={row.durationLabel} /> : null}
        </li>
      ))}
    </ul>
  );
}

function OptionalField({ label, value }: { label: string; value: string | null }) {
  if (value === null) {
    return <p className="hidden md:block" />;
  }
  return <Field label={label} value={value} numeric />;
}

function reportingPercent(covered: string, total: string): number {
  const coveredMw = Number(covered.replaceAll(",", ""));
  const totalMw = Number(total.replaceAll(",", ""));
  if (!Number.isFinite(coveredMw) || !Number.isFinite(totalMw) || totalMw === 0) {
    return 0;
  }
  return Math.round((coveredMw / totalMw) * 100);
}

function storageColor(technology: StorageShare["technology"]): string {
  switch (technology) {
    case "battery":
      return "var(--chart-battery)";
    case "pumped_storage":
      return "var(--chart-hydro)";
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}

function Field({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <p className={`min-w-0 break-words text-copy-14 text-gray-1000 ${numeric ? "tabular-nums" : ""}`}>
      <span className="text-label-12 text-gray-900 md:hidden">{label} </span>
      {value === NOT_AVAILABLE ? <Absent reason="Not published" /> : value}
    </p>
  );
}

function Magnitude({
  title,
  block,
  periodLabel,
  periodStart,
}: {
  title: string;
  block: StorageMagnitude;
  periodLabel: string;
  periodStart: string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-heading-16 text-gray-1000">{title}</h3>
      <p className="mt-1 break-words text-label-12 text-gray-900">
        <time dateTime={periodStart}>{periodLabel}</time>
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {block.rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 break-words text-copy-14 text-gray-900">{row.label}</span>
            <span className="text-copy-14 tabular-nums text-gray-1000">{row.mwLabel} MW</span>
          </li>
        ))}
      </ul>
      {block.missing.map((label) => (
        <p key={label} className="mt-3 break-words text-copy-14 text-gray-900">
          {label} <DataStateNotice state="not_yet_available" />
        </p>
      ))}
      {block.totalLabel ? (
        <p className="mt-3 text-copy-14 text-gray-1000">
          Total <span className="tabular-nums">{block.totalLabel} MW</span>
        </p>
      ) : null}
      {block.shares ? (
        <ul className="mt-2 flex flex-col gap-1">
          {block.shares.map((share) => (
            <li key={share.id} className="flex flex-wrap justify-between gap-x-3 text-label-12 text-gray-900">
              <span className="min-w-0 break-words">{share.label}</span>
              <span className="tabular-nums">{share.percent}%</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
