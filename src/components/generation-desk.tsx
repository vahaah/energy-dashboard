"use client";

import type { ReactNode } from "react";
import { balancePeriodId, EquationRow } from "@/components/equation-row";
import { ShareBar } from "@/components/share-bar";
import { SourceTable } from "@/components/source-table";
import { DemandBalanceChart } from "@/components/charts/demand-balance-chart";
import { LookAheadStrip } from "@/components/look-ahead-strip";
import { CardEmpty, CardLoading } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getDisplayedPower } from "@/lib/displayed-demand";
import {
  showsDemandForecast,
  showsLookAheadCopy,
  type LookAheadView,
} from "@/lib/forecast-model";
import { formatPlainSettlementWindow, fuelinstDelayNote } from "@/lib/generation-desk-view";
import { generationMixShares } from "@/lib/generation-share";
import { buildGroupedSourceTable } from "@/lib/source-groups";
import { captionGeneration } from "@/lib/attribution";
import { parseUtcDateTime } from "@/lib/london-time";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { LatestFacts } from "@/lib/facts";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";

const BALANCE_SOURCES = [
  { label: "Elexon BMRS", href: "/methodology#elexon-bmrs" },
  { label: "NESO", href: "/methodology#neso-open-data" },
  { label: "Sheffield Solar PV Live", href: "/methodology#sheffield-pv-live" },
] as const;

interface Props {
  facts: LatestFacts;
  snapshots: EnergySnapshot[];
  headlineSnapshots: EnergySnapshot[];
  generation: Generation5min[];
  headlineGeneration: Generation5min[];
  range: TimeRange;
  pending?: boolean;
  now?: Date;
  lookAhead?: LookAheadView | null;
  neso?: boolean;
  question?: string;
  answer?: string;
  actions?: ReactNode;
}

export function GenerationDesk({
  facts,
  snapshots,
  headlineSnapshots,
  generation,
  headlineGeneration,
  range,
  pending = false,
  now = new Date(),
  lookAhead = null,
  neso = false,
  question = "What's powering Britain?",
  answer = "",
  actions = null,
}: Props) {
  const power = getDisplayedPower(facts, headlineSnapshots);
  const shares = generationMixShares(facts.generationRows, power.generationStartUtc);
  const table = buildGroupedSourceTable(
    facts.generationRows,
    power.demandMw,
    headlineGeneration.length > 0 ? headlineGeneration : generation,
    power.generationStartUtc
  );
  const hasChart = snapshots.length > 0 || generation.length > 0;
  const delayNote = facts.isHistorical ? null : fuelinstDelayNote(facts.generationRows, now);
  const periodStart = power.generationStartUtc ?? power.demandStartUtc;

  return (
    <div className="flex flex-col">
      <header className="flex flex-col px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <h2 className="text-heading-16 font-semibold text-gray-1000">{question}</h2>
          {answer ? <p className="mt-1 max-w-prose text-copy-14 text-gray-900">{answer}</p> : null}
        </div>
        {actions ? <div className="mt-3 shrink-0 sm:mt-0">{actions}</div> : null}
      </header>
      {pending ? (
        <EquationSkeleton />
      ) : (
        <EquationRow power={power} />
      )}
      {pending ? (
        <div className="px-4 pb-6 sm:px-6">
          <Skeleton className="h-3 w-full rounded-sm" />
        </div>
      ) : (
        <ShareBar
          shares={shares}
          generationMw={power.generationMw}
          carbon={facts.carbon.value}
          carbonHelp={facts.carbon.definition}
        />
      )}
      <BalanceFooter
        periodStart={periodStart}
        stale={power.alignmentNote != null}
        batteryFootnote={!power.publishesBatteryCharging && power.generationMw != null}
      />
      {delayNote ? (
        <p className="px-4 pt-3 text-label-12 text-gray-900 sm:px-6">{delayNote}</p>
      ) : null}
      <div className="flex flex-col gap-5 px-4 pt-5 pb-4 sm:px-6 sm:pb-6">

      {pending ? (
        <SourceTableSkeleton />
      ) : (
        <SourceTable table={table} />
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-heading-16 text-gray-1000">Demand and generation, including embedded</h3>
          <InfoTooltip
            text="The lines are transmission demand plus estimated embedded wind and solar, and GB generation including that embedded output. The headline above is the half-hour supply balance."
            label="What is Demand and generation, including embedded?"
          />
        </div>
        {pending ? (
          <CardLoading />
        ) : hasChart ? (
          <DemandBalanceChart
            snapshots={snapshots}
            generation={generation}
            range={range}
            demandForecast={
              lookAhead && showsDemandForecast(range, facts.isHistorical)
                ? lookAhead.demandSeries
                : []
            }
            demandBasis={
              lookAhead && showsDemandForecast(range, facts.isHistorical)
                ? lookAhead.demandBasis
                : null
            }
            now={lookAhead && showsDemandForecast(range, facts.isHistorical) ? now : null}
          />
        ) : (
          <CardEmpty stamp={facts.headerStamp} />
        )}
        <p className="mt-2 text-label-12 text-gray-900">{captionGeneration(neso)}</p>
      </div>
      {lookAhead && showsLookAheadCopy(facts) ? (
        <LookAheadStrip lookAhead={lookAhead} />
      ) : null}
      </div>
    </div>
  );
}

function BalanceFooter({
  periodStart,
  stale,
  batteryFootnote,
}: {
  periodStart: string | null;
  stale: boolean;
  batteryFootnote: boolean;
}) {
  const windowLabel = periodStart ? formatPlainSettlementWindow(periodStart) : null;
  const dateTime = periodStart ? settlementInterval(periodStart) : null;

  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-alpha-400 px-4 py-3 text-label-12 text-gray-900 sm:px-6">
      {windowLabel && dateTime ? (
        <p className="w-full sm:w-auto">
          <time id={balancePeriodId()} dateTime={dateTime} className="text-mono-12">
            {windowLabel}
          </time>{" "}
          settlement period
        </p>
      ) : null}
      {stale ? (
        <p role="status" className="flex w-full items-center gap-1.5 text-amber-700 sm:w-auto">
          <span className="size-1.5 rounded-full bg-amber-700" aria-hidden="true" />
          Latest settlement period is not in yet
        </p>
      ) : null}
      <p className="w-full sm:ml-auto sm:w-auto">
        {BALANCE_SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? " · " : null}
            <a href={source.href} className="underline-offset-2 hover:text-gray-1000 hover:underline">
              {source.label}
            </a>
          </span>
        ))}
      </p>
      {batteryFootnote ? <p className="w-full text-gray-900">Battery charging isn’t published.</p> : null}
    </footer>
  );
}

function settlementInterval(startUtc: string): string {
  const period = getSettlementPeriod(parseUtcDateTime(startUtc));
  const compact = (date: Date) => `${date.toISOString().slice(0, 16)}Z`;
  return `${compact(period.startUtc)}/${compact(period.endUtc)}`;
}

export function GenerationDeskSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <EquationSkeleton />
      <Skeleton className="h-3 w-full rounded-full" />
      <SourceTableSkeleton />
      <CardLoading />
    </div>
  );
}

function EquationSkeleton() {
  return (
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`eq-${index}`} className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-24" />
        </div>
      ))}
    </div>
  );
}

function SourceTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={`row-${index}`} className="h-9 w-full" />
      ))}
    </div>
  );
}
