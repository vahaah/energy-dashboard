"use client";

import { EquationRow } from "@/components/equation-row";
import { MixBar } from "@/components/mix-bar";
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
import { fuelinstDelayNote } from "@/lib/generation-desk-view";
import { MIX_BAR_HELP, buildGroupedSourceTable } from "@/lib/source-groups";
import type { LatestFacts } from "@/lib/facts";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";

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
}: Props) {
  const power = getDisplayedPower(facts, headlineSnapshots);
  const table = buildGroupedSourceTable(
    power.generationRows,
    power.demandMw,
    headlineGeneration.length > 0 ? headlineGeneration : generation
  );
  const hasChart = snapshots.length > 0 || generation.length > 0;
  const notes: string[] = [];
  const delayNote = facts.isHistorical ? null : fuelinstDelayNote(facts.generationRows, now);
  if (delayNote) {
    notes.push(delayNote);
  }
  if (power.alignmentNote) {
    notes.push(power.alignmentNote);
  }
  const statusNote = notes.join(" · ");

  return (
    <div className="flex flex-col gap-5">
      {pending ? (
        <EquationSkeleton />
      ) : (
        <EquationRow
          demandMw={power.demandMw}
          generationMw={power.generationMw}
          transfersMw={power.transfersMw}
          demandSource={power.demandSource}
          generationSource={power.generationSource}
          transfersSource={power.transfersSource}
          demandDefinition={power.demandDefinition}
          transmissionDemandMw={power.transmissionDemandMw}
          demandStartUtc={power.demandStartUtc}
          generationStartUtc={power.generationStartUtc}
          transfersStartUtc={power.transfersStartUtc}
        />
      )}
      {statusNote ? (
        <p className="text-label-12 text-gray-900" aria-live="polite">
          {statusNote}
        </p>
      ) : null}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-label-13 text-gray-900">Share of demand</p>
          <InfoTooltip text={MIX_BAR_HELP} label="What is Share of demand?" />
        </div>
        {pending ? <Skeleton className="h-3 w-full rounded-full" /> : <MixBar table={table} />}
      </div>

      {pending ? (
        <SourceTableSkeleton />
      ) : (
        <SourceTable table={table} />
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-heading-16 text-gray-1000">Demand and generation, including embedded</h3>
          <InfoTooltip
            text="Demand is transmission demand plus estimated embedded wind and solar. Generation is GB plant plus the same embedded series. The gap is imports when demand is higher and exports when generation is higher."
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
      </div>
      {lookAhead && showsLookAheadCopy(facts) ? (
        <LookAheadStrip lookAhead={lookAhead} />
      ) : null}
    </div>
  );
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
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
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
