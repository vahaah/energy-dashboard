import Link from "next/link";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { DataStateNotice } from "@/components/ui/data-state";
import { Card } from "@/components/ui/card";
import { NOT_AVAILABLE } from "@/lib/assets/labels";
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
import type { StorageDocument, StorageMagnitude, StorageRow, StorageShare } from "@/lib/storage/page-model";

export function StorageBoard({ document }: { document: StorageDocument }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 sm:col-span-6">
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
      <div className="col-span-12 sm:col-span-6">
        <Card size="stat" title={ENERGY_CAPACITY} className="h-full">
          <StatValue value={document.energy?.totalLabel ?? NOT_AVAILABLE} unit={document.energy ? "MWh" : null} />
          <p className="mt-2 break-words text-label-12 text-gray-900">{document.energyNote}</p>
        </Card>
      </div>
      <div className="col-span-12">
        <Card size="stat" title={document.coverage.label} tooltip={document.coverage.help} className="h-full">
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-sans text-heading-24 tabular-nums text-gray-1000">{document.coverage.percentLabel}</span>
            <span className="text-copy-14 tabular-nums text-gray-900" data-coverage-fraction>
              {document.coverage.fractionLabel}
            </span>
          </p>
        </Card>
      </div>

      <div className="col-span-12">
        <Card title={INVENTORY_HEADING} footer={<p className="break-words">{document.inventoryAttribution}</p>}>
          <p className="break-words text-copy-14 text-gray-900">{INVENTORY_INTRO}</p>
          {document.notOperatingCount > 0 ? (
            <p className="mt-3 break-words text-copy-14 text-gray-900">
              {document.notOperatingCount} records are not operating and are left out of the operating total.
            </p>
          ) : null}
          <ShareList shares={document.rated?.shares ?? []} unit="MW" />
          <p className="mt-4 flex flex-wrap items-center gap-1 text-label-12 text-gray-900 md:hidden">
            {NOMINAL_DURATION}
            <InfoTooltip text={DURATION_TOOLTIP} label={`What is ${NOMINAL_DURATION}?`} />
          </p>
          <InventoryTable rows={document.rows} />
        </Card>
      </div>

      <div className="col-span-12">
        <Card title={MONITORED_HEADING} footer={<p className="break-words">{document.monitoredAttribution}</p>}>
          <p className="break-words text-copy-14 text-gray-900">{MONITORED_INTRO}</p>
          <p className="mt-3 break-words text-copy-14 text-gray-900">{STORAGE_SIGN}</p>
          {document.monitored.available ? (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Magnitude title={DISCHARGING} block={document.monitored.discharge} periodLabel={document.monitored.periodLabel} periodStart={document.monitored.periodStart} />
              <Magnitude title={CHARGING} block={document.monitored.charge} periodLabel={document.monitored.periodLabel} periodStart={document.monitored.periodStart} />
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
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
      <span className="font-sans text-heading-24 tabular-nums text-gray-1000">{value}</span>
      {unit && value !== NOT_AVAILABLE ? <span className="text-label-13 text-gray-900">{unit}</span> : null}
    </p>
  );
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
            <div className="h-2 rounded-sm bg-gray-1000" style={{ width: `${share.percent}%`, opacity: 0.85 }} />
          </div>
          <p className="mt-1 text-label-12 text-gray-900">
            {share.mwLabel} {unit}
          </p>
        </li>
      ))}
    </ul>
  );
}

function InventoryTable({ rows }: { rows: readonly StorageRow[] }) {
  return (
    <div className="mt-4">
      <div className="hidden min-w-0 grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_repeat(3,minmax(0,1fr))] gap-3 border-b border-gray-alpha-400 py-2 text-label-12 text-gray-900 md:grid">
        <p className="min-w-0 break-words">Station</p>
        <p className="min-w-0 break-words">Technology</p>
        <p className="min-w-0 break-words">{RATED_CAPACITY} (MW)</p>
        <p className="min-w-0 break-words">{ENERGY_CAPACITY} (MWh)</p>
        <p className="flex min-w-0 flex-wrap items-center gap-1 break-words">
          {NOMINAL_DURATION}
          <InfoTooltip text={DURATION_TOOLTIP} label={`What is ${NOMINAL_DURATION}?`} align="end" />
        </p>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-1 gap-1 border-b border-gray-alpha-400 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_repeat(3,minmax(0,1fr))] md:gap-3"
          >
            <p className="min-w-0 break-words text-copy-14 text-gray-1000">
              {row.href ? (
                <Link href={row.href} className="text-blue-700 underline-offset-2 hover:underline">
                  {row.name}
                </Link>
              ) : (
                row.name
              )}
            </p>
            <Field label="Technology" value={row.technologyLabel} />
            <Field label={`${RATED_CAPACITY} (MW)`} value={row.ratedLabel} numeric />
            <Field label={`${ENERGY_CAPACITY} (MWh)`} value={row.energyLabel} numeric />
            <Field label={NOMINAL_DURATION} value={row.durationLabel} numeric />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <p className={`min-w-0 break-words text-copy-14 text-gray-1000 ${numeric ? "tabular-nums" : ""}`}>
      <span className="text-label-12 text-gray-900 md:sr-only">{label} </span>
      {value}
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
