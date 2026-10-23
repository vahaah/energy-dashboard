"use client";

import type { ReactNode } from "react";
import { balancePeriodId, EquationRow } from "@/components/equation-row";
import { ShareBar } from "@/components/share-bar";
import { SourceTable } from "@/components/source-table";
import { DemandBalanceChart } from "@/components/charts/demand-balance-chart";
import { LookAheadStrip } from "@/components/look-ahead-strip";
import { CARD_PAD_BOTTOM, CARD_PAD_TOP, CARD_PAD_X, CardEmpty, CardLoading } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state";
import { Freshness } from "@/components/ui/freshness";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getDisplayedPower, type DisplayedPower } from "@/lib/displayed-demand";
import {
  showsDemandForecast,
  showsLookAheadCopy,
  type LookAheadView,
} from "@/lib/forecast-model";
import { formatPlainSettlementWindow, fuelinstDelayNote } from "@/lib/generation-desk-view";
import { generationMixShares } from "@/lib/generation-share";
import { buildGroupedSourceTable } from "@/lib/source-groups";
import { captionGeneration } from "@/lib/attribution";
import { SETTLEMENT_PUBLICATION_GRACE_MS } from "@/lib/data-state";
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
      <header
        data-slot="card-pad"
        className={`flex flex-col ${CARD_PAD_X} ${CARD_PAD_TOP} sm:flex-row sm:items-start sm:justify-between`}
      >
        <div className="min-w-0">
          <h2 className="text-heading-16 font-semibold text-gray-1000">{question}</h2>
          {answer ? <p className="mt-1 max-w-prose text-copy-14 text-gray-900">{answer}</p> : null}
        </div>
        {actions ? <div className="mt-3 shrink-0 sm:mt-0">{actions}</div> : null}
      </header>
      {pending ? (
        <div data-slot="card-pad" className={`flex flex-col gap-3 ${CARD_PAD_X}`}>
          <DataStateNotice state="loading" />
          <EquationSkeleton />
        </div>
      ) : (
        <EquationRow power={power} />
      )}
      {pending ? (
        <div data-slot="card-pad" className={`${CARD_PAD_X} ${CARD_PAD_BOTTOM}`}>
          <Skeleton className="h-3 w-full rounded-sm" />
        </div>
      ) : (
        <ShareBar
          shares={shares}
          generationGw={
            power.generationMw == null
              ? null
              : (power.terms.find((term) => term.id === "generation")?.displayGw ?? null)
          }
          carbon={facts.carbon.value}
          carbonHelp={facts.carbon.definition}
        />
      )}
      <BalanceFooter
        periodStart={periodStart}
        status={balanceFooterStatus(power, now)}
        batteryFootnote={!power.publishesBatteryCharging && power.generationMw != null}
      />
      {delayNote ? (
        <div
          data-slot="card-pad"
          className={`flex flex-wrap items-center gap-2 ${CARD_PAD_X} pt-3 text-label-12 text-gray-900`}
        >
          <Freshness state="stale" detail={delayNote} />
        </div>
      ) : null}
      <div data-slot="card-pad" className={`flex flex-col gap-5 ${CARD_PAD_X} pt-5 ${CARD_PAD_BOTTOM}`}>

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

type BalanceFooterStatus = "stale" | "waiting" | "incomplete" | null;

function balanceFooterStatus(power: DisplayedPower, now: Date): BalanceFooterStatus {
  if (power.alignmentNote != null) {
    const period = power.generationStartUtc ?? power.demandStartUtc;
    if (period != null) {
      const end = getSettlementPeriod(parseUtcDateTime(period)).endUtc.getTime();
      if (now.getTime() - end <= SETTLEMENT_PUBLICATION_GRACE_MS) {
        return "waiting";
      }
    }
    return "stale";
  }
  const period = power.generationStartUtc ?? power.demandStartUtc;
  if (!power.balanceClosed && period != null) {
    return "incomplete";
  }
  return null;
}

function balanceStatusCopy(status: BalanceFooterStatus): string | null {
  switch (status) {
    case "stale":
    case "waiting":
      return "Latest settlement period is not in yet";
    case "incomplete":
      return "Half-hour balance is incomplete.";
    case null:
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function BalanceFooter({
  periodStart,
  status,
  batteryFootnote,
}: {
  periodStart: string | null;
  status: BalanceFooterStatus;
  batteryFootnote: boolean;
}) {
  const windowLabel = periodStart ? formatPlainSettlementWindow(periodStart) : null;
  const dateTime = periodStart ? settlementInterval(periodStart) : null;
  const statusCopy = balanceStatusCopy(status);

  return (
    <footer
      data-slot="card-footer"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-alpha-400 ${CARD_PAD_X} py-3 text-label-12 text-gray-900`}
    >
      {windowLabel && dateTime ? (
        <p className="w-full sm:w-auto">
          <time id={balancePeriodId()} dateTime={dateTime} className="text-mono-12">
            {windowLabel}
          </time>{" "}
          settlement period
        </p>
      ) : null}
      {status === "stale" ? <Freshness state="stale" /> : null}
      {status === "incomplete" ? <DataStateNotice state="partial" /> : null}
      {statusCopy ? (
        <p role="status" className="w-full text-gray-900 sm:w-auto">
          {statusCopy}
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
    <div data-slot="card-pad" className={`flex flex-col gap-5 ${CARD_PAD_X} ${CARD_PAD_TOP} ${CARD_PAD_BOTTOM}`}>
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
