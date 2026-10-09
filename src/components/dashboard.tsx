"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type {
  CommodityPrice,
  EnergySnapshot,
  Generation5min,
} from "@/lib/types";
import type { DashboardSearchParams } from "@/lib/dashboard-search-params";
import {
  dashboardSearchParamParsers,
  dateParamForRange,
} from "@/lib/dashboard-search-params";
import { buildAnswerSentence } from "@/lib/answer-sentence";
import { getDisplayedPower } from "@/lib/displayed-demand";
import {
  COMMODITY_CARD_KEYS,
  COMMODITY_CARD_LABELS,
  COMMODITY_COLORS,
  COMMODITY_LABELS,
  commodityDisplayIndex,
} from "@/lib/colors";
import { PUBLIC_COMMODITIES } from "@/lib/commodity-series";
import { GB_GAS_SAP_COMMODITY } from "@/lib/gb-gas-sap";
import { normalizeFuelType, splitLatestGenerationRows } from "@/lib/dashboard-model";
import { GenerationDesk, GenerationDeskSkeleton } from "@/components/generation-desk";
import { SectionBlock } from "@/components/section-block";
import { SiteHeader } from "@/components/site-header";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { GbGasSapCard } from "@/components/gb-gas-sap-card";
import { Skeleton } from "@/components/ui/skeleton";
import { CarbonIntensityChart } from "@/components/charts/carbon-intensity-chart";
import { ElectricityPriceChart } from "@/components/charts/price-chart";
import { GenerationStackChart } from "@/components/charts/generation-stack-chart";
import { CommodityChart } from "@/components/charts/commodity-chart";
import { InterconnectorChart } from "@/components/charts/interconnector-chart";
import { InterconnectorFlowsChart } from "@/components/charts/interconnector-flows-chart";
import type { LatestFacts } from "@/lib/facts";

const COMMODITY_RANGE_OPTIONS = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
] as const;

interface Props {
  searchParams: DashboardSearchParams;
  selectedDate: string;
  todayDate: string;
  facts: LatestFacts;
  initialSnapshots: EnergySnapshot[];
  headlineSnapshots: EnergySnapshot[];
  initialPrices: CommodityPrice[];
  generationHistory: Generation5min[];
  headlineGeneration: Generation5min[];
}

export function Dashboard({
  searchParams,
  selectedDate,
  todayDate,
  facts,
  initialSnapshots,
  headlineSnapshots,
  initialPrices,
  generationHistory,
  headlineGeneration,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [urlState, setUrlState] = useQueryStates(dashboardSearchParamParsers, {
    history: "push",
    shallow: false,
    scroll: false,
    startTransition,
  });

  const range = urlState.range ?? searchParams.range;
  const commodityRange = urlState.commodityRange ?? searchParams.commodityRange;
  const focus = urlState.focus ?? searchParams.focus;
  const activeDate = urlState.date ?? searchParams.date ?? selectedDate ?? todayDate;
  const power = getDisplayedPower(facts, headlineSnapshots);

  useEffect(() => {
    if (focus === "overview") return;
    const section = document.getElementById(`section-${focus}`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        startTransition(() => {
          router.refresh();
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router, startTransition]);

  const topShare = useMemo(() => {
    if (facts.shares.length === 0) {
      return null;
    }
    return [...facts.shares].sort((left, right) => right.mw - left.mw)[0] ?? null;
  }, [facts.shares]);

  const answer = buildAnswerSentence({
    topFuel: topShare?.fuel ?? null,
    topMw: topShare?.mw ?? null,
    transfersMw: power.transfersMw,
    empty: facts.empty,
  });

  const commodityStats = useMemo(() => {
    const groups = new Map<string, CommodityPrice[]>();
    for (const price of initialPrices) {
      if (!groups.has(price.commodity)) {
        groups.set(price.commodity, []);
      }
      groups.get(price.commodity)?.push(price);
    }

    return Array.from(groups.entries())
      .sort(([left], [right]) => commodityDisplayIndex(left) - commodityDisplayIndex(right))
      .map(([commodity, rows]) => {
        const sortedRows = [...rows].sort(
          (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
        );
        const first = sortedRows[0];
        const latest = sortedRows.at(-1);
        const absoluteDelta = latest && first ? latest.price - first.price : 0;
        const percentageDelta =
          first && first.price !== 0 ? (absoluteDelta / first.price) * 100 : 0;

        return {
          commodity,
          latest,
          absoluteDelta,
          percentageDelta,
        };
      });
  }, [initialPrices]);

  const commodityCards = commodityStats.filter((stat) =>
    COMMODITY_CARD_KEYS.some((key) => key === stat.commodity)
  );

  const latestInterconnectors = useMemo(
    () => splitLatestGenerationRows(power.generationRows).interconnectors,
    [power.generationRows]
  );

  const hasSnapshots = initialSnapshots.length > 0;
  const hasInterconnectorHistory = generationHistory.some((row) =>
    normalizeFuelType(row.fuel_type).startsWith("int")
  );

  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <a
        href="#section-overview"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-md focus:border focus:border-gray-alpha-400 focus:bg-background-100 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <SiteHeader
        range={range}
        onRangeChange={(nextRange) => {
          void setUrlState({
            range: nextRange,
            date: dateParamForRange(nextRange, urlState.date ?? searchParams.date),
          });
        }}
        activeDate={activeDate}
        minDate={facts.coverageStart}
        maxDate={todayDate}
        onDateChange={(date) => {
          void setUrlState({ date: date || todayDate });
        }}
        showDate={range === "24h"}
        stamp={facts.headerStamp}
        pending={isPending}
        copied={copied}
        onShare={async () => {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      />

      <main className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-6 sm:gap-16 sm:px-6 sm:py-10">
        {facts.empty && facts.emptyState && !isPending ? (
          <div className="surface-card p-6 text-copy-16 text-gray-1000">
            <h1 className="text-heading-32">{answer}</h1>
            <p className="mt-3 text-copy-16 text-gray-900">{facts.emptyState.message}</p>
            <a
              href={facts.emptyState.href}
              className="mt-4 inline-flex h-8 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000"
            >
              {facts.emptyState.action}
            </a>
          </div>
        ) : (
          <section id="section-overview" className="scroll-mt-28">
            <p className="text-label-13 text-gray-900">What&apos;s powering Britain</p>
            {isPending ? (
              <Skeleton className="mt-2 h-10 w-full max-w-3xl" />
            ) : (
              <h1 className="mt-1 text-heading-32 text-gray-1000">{answer}</h1>
            )}
            <div id="section-generation" className="mt-6 scroll-mt-28">
              {isPending ? (
                <GenerationDeskSkeleton />
              ) : (
                <GenerationDesk
                  facts={facts}
                  snapshots={initialSnapshots}
                  headlineSnapshots={headlineSnapshots}
                  generation={generationHistory}
                  headlineGeneration={headlineGeneration}
                  range={range}
                  pending={isPending}
                />
              )}
            </div>
          </section>
        )}

        <SectionBlock
          id="section-price"
          title="What does power cost?"
          tooltip="The system (imbalance) price is the cash-out price for being long or short in a half-hour. It is not the day-ahead wholesale price."
          active={focus === "price"}
        >
          {isPending ? (
            <Skeleton className="h-[200px] w-full rounded-xl sm:h-[280px]" />
          ) : hasSnapshots ? (
            <ElectricityPriceChart data={initialSnapshots} range={range} />
          ) : (
            <EmptyState stamp={facts.headerStamp} />
          )}
        </SectionBlock>

        <SectionBlock
          id="section-transfers"
          title="Where is power flowing?"
          tooltip="Interconnector flows into and out of Great Britain. Positive values are imports."
          active={focus === "transfers"}
        >
          {isPending ? (
            <TransfersSkeleton />
          ) : hasInterconnectorHistory ? (
            <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
              <div>
                <h3 className="mb-3 text-heading-16 text-gray-1000">Latest flows</h3>
                <InterconnectorChart data={latestInterconnectors} />
              </div>
              <div>
                <h3 className="mb-3 text-heading-16 text-gray-1000">Flows over time</h3>
                <InterconnectorFlowsChart data={generationHistory} range={range} />
              </div>
            </div>
          ) : (
            <EmptyState stamp={facts.headerStamp} />
          )}
        </SectionBlock>

        <SectionBlock
          title="How has the mix changed?"
          tooltip="How the generation stack shifts through the selected window, including embedded solar and wind."
        >
          {isPending ? (
            <Skeleton className="h-[200px] w-full rounded-xl sm:h-[280px]" />
          ) : generationHistory.length > 0 ? (
            <GenerationStackChart data={generationHistory} range={range} />
          ) : (
            <EmptyState stamp={facts.headerStamp} />
          )}
        </SectionBlock>

        <SectionBlock
          id="section-commodities"
          title="Gas & oil"
          tooltip="Oil and gas context on a slower market horizon. The chart keeps the full published set."
          active={focus === "commodities"}
          headerRight={
            <TimeRangeSelector
              value={commodityRange}
              onChange={(nextRange) => {
                void setUrlState({ commodityRange: nextRange });
              }}
              options={COMMODITY_RANGE_OPTIONS}
              pending={isPending}
              compact
              variant="tabs"
              ariaLabel="Commodity range"
            />
          }
        >
          {isPending ? (
            <CommoditySkeleton />
          ) : (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                {commodityCards.map(({ commodity, latest, absoluteDelta, percentageDelta }) =>
                  commodity === GB_GAS_SAP_COMMODITY ? (
                    <GbGasSapCard
                      key={commodity}
                      latest={latest}
                      absoluteDelta={absoluteDelta}
                      percentageDelta={percentageDelta}
                    />
                  ) : (
                    <CommodityStatCard
                      key={commodity}
                      commodity={commodity}
                      latest={latest}
                      absoluteDelta={absoluteDelta}
                      percentageDelta={percentageDelta}
                    />
                  )
                )}
              </div>
              {initialPrices.length > 0 ? (
                <CommodityChart
                  data={initialPrices}
                  range={commodityRange}
                  selectedSeries={[...PUBLIC_COMMODITIES]}
                />
              ) : (
                <EmptyState stamp={facts.headerStamp} />
              )}
            </>
          )}
        </SectionBlock>

        <SectionBlock
          id="section-carbon"
          title="How clean is it?"
          tooltip="Carbon intensity of GB electricity through the selected window. The line is a single colour; the bands behind it are the official index ranges."
          active={focus === "carbon"}
        >
          {isPending ? (
            <Skeleton className="h-[200px] w-full rounded-xl sm:h-[280px]" />
          ) : hasSnapshots ? (
            <CarbonIntensityChart data={initialSnapshots} range={range} />
          ) : (
            <EmptyState stamp={facts.headerStamp} />
          )}
        </SectionBlock>

        <footer className="border-t border-gray-alpha-400 pt-8 pb-4">
          <h2 className="text-heading-16 text-gray-1000">Sources and methodology</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Grid metrics are refreshed from the Carbon Intensity API, Elexon BMRS, NESO embedded
            wind, and Sheffield Solar PV Live. The system price is the Elexon imbalance (cash-out)
            price, not day-ahead wholesale. Oil and gas prices come from EIA, World Bank Commodity
            Price Data (The Pink Sheet, CC BY 4.0), and National Gas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-mono-12 text-gray-900">
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/snapshots?range={range}
            </code>
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/generation?range={range}
            </code>
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/prices?range={commodityRange}
            </code>
          </div>
          <p className="mt-3 text-label-12 text-gray-900">
            URL state is canonical for the selected range, commodity horizon, and section focus.
            Rate limit remains 60 requests per minute.
          </p>
        </footer>
      </main>
    </div>
  );
}

function CommodityStatCard({
  commodity,
  latest,
  absoluteDelta,
  percentageDelta,
}: {
  commodity: string;
  latest: CommodityPrice | undefined;
  absoluteDelta: number;
  percentageDelta: number;
}) {
  const rising = absoluteDelta >= 0;

  return (
    <div className="surface-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label-13 text-gray-900">
          {COMMODITY_CARD_LABELS[commodity] ?? COMMODITY_LABELS[commodity] ?? commodity}
        </p>
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: COMMODITY_COLORS[commodity] ?? "#64748b" }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 font-sans text-heading-32 tabular-nums text-gray-1000">
        {latest ? formatCommodityPrice(latest) : "—"}
        {latest ? (
          <span className="text-heading-32 text-gray-700">{commodityUnitSuffix(latest.unit)}</span>
        ) : null}
      </p>
      <p className={`mt-1 text-label-12 ${rising ? "text-green-700" : "text-red-700"}`}>
        {rising ? (
          <ArrowUpRight className="mr-0.5 inline size-3.5" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="mr-0.5 inline size-3.5" aria-hidden="true" />
        )}
        {formatSignedCurrency(absoluteDelta, latest?.currency)} · {formatSignedPercentage(percentageDelta)}
      </p>
    </div>
  );
}

function TransfersSkeleton() {
  return (
    <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl sm:h-[280px]" />
    </div>
  );
}

function CommoditySkeleton() {
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {COMMODITY_CARD_KEYS.map((commodity) => (
          <Skeleton key={commodity} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[200px] w-full rounded-xl sm:h-[280px]" />
    </>
  );
}

function EmptyState({ stamp }: { stamp: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-gray-alpha-400 bg-background-200 text-copy-14 text-gray-900">
      Data is catching up. Last update {stamp.replace("Data as of ", "")}
    </div>
  );
}

function formatCommodityPrice(latest: CommodityPrice): string {
  const symbol = latest.currency === "EUR" ? "€" : latest.currency === "GBP" ? "£" : "$";
  return `${symbol}${latest.price.toFixed(2)}`;
}

function formatSignedCurrency(value: number, currency?: string): string {
  const prefix = value >= 0 ? "+" : "−";
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  return `${prefix}${symbol}${Math.abs(value).toFixed(2)}`;
}

function formatSignedPercentage(value: number): string {
  const prefix = value >= 0 ? "+" : "−";
  return `${prefix}${Math.abs(value).toFixed(1)}%`;
}

function commodityUnitSuffix(unit: string): string {
  return ` ${unit.replace("BBL", "bbl").replace("MMBTU", "MMBtu")}`;
}
