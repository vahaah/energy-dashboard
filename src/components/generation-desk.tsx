"use client";

import { Stat } from "@/components/ui/stat";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { DemandBalanceChart } from "@/components/charts/demand-balance-chart";
import { GenerationNowCard } from "@/components/charts/generation-now-card";
import type { LatestFacts } from "@/lib/facts";
import type { EnergySnapshot, Generation5min, TimeRange } from "@/lib/types";
import { buildGenerationDeskView, GENERATION_DESK_RANGE_OPTIONS } from "@/lib/generation-desk-view";

interface Props {
  facts: LatestFacts;
  snapshots: EnergySnapshot[];
  generation: Generation5min[];
  range: TimeRange;
  pending?: boolean;
  now?: Date;
  onRangeChange: (range: TimeRange) => void;
}

export function GenerationDesk({
  facts,
  snapshots,
  generation,
  range,
  pending = false,
  now = new Date(),
  onRangeChange,
}: Props) {
  const { answers, nowView, delayNote, alignmentNote } = buildGenerationDeskView(facts, now);
  const hasChart = snapshots.length > 0 || generation.length > 0;
  const notes: string[] = [];
  if (delayNote) {
    notes.push(delayNote);
  }
  if (alignmentNote) {
    notes.push(alignmentNote);
  }
  const statusNote = notes.join(" · ");

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-alpha-400 bg-background-200 p-6 sm:grid-cols-3 xl:col-span-12">
        {answers.map((answer, index) => (
          <div
            key={answer.stat}
            className={index === 2 ? "col-span-2 sm:col-span-1" : undefined}
          >
            <Stat
              stat={answer.stat}
              label={answer.label}
              value={answer.value}
              unit={answer.unit}
              datetime={answer.datetime}
              timeLabel={answer.timeLabel}
              source={answer.source}
              size="headline"
            />
          </div>
        ))}
        {statusNote ? (
          <p
            className="col-span-2 text-xs font-medium text-gray-1000 sm:col-span-3"
            aria-live="polite"
          >
            {statusNote}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 rounded-xl border border-gray-alpha-400 bg-background-200 p-6 xl:col-span-5">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-xs font-medium text-gray-1000">Powering Britain now</h3>
          <InfoTooltip
            text="Domestic generation from the latest Elexon FUELINST frame, with embedded wind and solar joined at or within 30 minutes. Interconnectors sit in net imports, not this list."
            label="What is Powering Britain now?"
          />
        </div>
        <p className="mb-4 text-sm text-gray-900">Now, by source · sorted by size · share of demand</p>
        <GenerationNowCard view={nowView} />
      </div>

      <div className="min-w-0 rounded-xl border border-gray-alpha-400 bg-background-200 p-6 xl:col-span-7">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium text-gray-1000">Demand and domestic generation</h3>
            <InfoTooltip
              text="Demand is transmission system demand. Domestic generation is GB plant plus estimated embedded wind and solar. The shaded gap is imports when demand is higher, and exports when generation is higher."
              label="What is Demand and domestic generation?"
            />
          </div>
          <TimeRangeSelector
            value={range}
            onChange={onRangeChange}
            options={GENERATION_DESK_RANGE_OPTIONS}
            pending={pending}
            compact
            ariaLabel="Generation time range"
          />
        </div>
        {hasChart ? (
          <DemandBalanceChart
            snapshots={snapshots}
            generation={generation}
            range={range}
          />
        ) : (
          <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-gray-alpha-400 text-sm text-gray-900 sm:h-80">
            No demand or generation history for this window
          </div>
        )}
      </div>
    </div>
  );
}

export function GenerationDeskSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-alpha-400 bg-background-200 p-6 sm:grid-cols-3 xl:col-span-12">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`answer-${index}`} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-alpha-400 bg-background-200 p-6 xl:col-span-5">
        <Skeleton className="mb-4 h-3 w-36" />
        <Skeleton className="mb-5 h-3 w-full rounded-full" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={`source-${index}`} className="h-6 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-alpha-400 bg-background-200 p-6 xl:col-span-7">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-11 w-48 rounded-full" />
        </div>
        <Skeleton className="h-60 w-full rounded-xl sm:h-80" />
      </div>
    </div>
  );
}
