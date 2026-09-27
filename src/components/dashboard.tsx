"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
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
import { formatHeadlineGw, type LatestFacts } from "@/lib/facts";
import {
  buildRangeSummary,
  headlineAsOf,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import {
  COMMODITY_CARD_LABELS,
  COMMODITY_COLORS,
  COMMODITY_LABELS,
  FUELINST_LABELS,
  carbonIndexColor,
  commodityDisplayIndex,
} from "@/lib/colors";
import { PUBLIC_COMMODITIES } from "@/lib/commodity-series";
import { GB_GAS_SAP_COMMODITY } from "@/lib/gb-gas-sap";
import { GbGasSapCard } from "@/components/gb-gas-sap-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { CarbonIntensityChart } from "@/components/charts/carbon-intensity-chart";
import { ElectricityPriceChart } from "@/components/charts/price-chart";
import { DemandChart } from "@/components/charts/demand-chart";
import { GenerationMixChart } from "@/components/charts/generation-mix-chart";
import { GenerationStackChart } from "@/components/charts/generation-stack-chart";
import { CommodityChart } from "@/components/charts/commodity-chart";
import { GenerationTable } from "@/components/charts/generation-table";
import { InterconnectorChart } from "@/components/charts/interconnector-chart";
import { DemandBalanceChart } from "@/components/charts/demand-balance-chart";
import { InterconnectorFlowsChart } from "@/components/charts/interconnector-flows-chart";
import {
  Activity,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Copy,
  Droplets,
  Gauge,
  Layers3,
  LineChart,
  RefreshCw,
  Wind,
  Zap,
} from "lucide-react";

const GLOBAL_RANGE_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
] as const;

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
  initialPrices: CommodityPrice[];
  generationHistory: Generation5min[];
}

export function Dashboard({
  searchParams,
  selectedDate,
  todayDate,
  facts,
  initialSnapshots,
  initialPrices,
  generationHistory,
}: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedCommodities, setSelectedCommodities] = useState<string[]>([
    ...PUBLIC_COMMODITIES,
  ]);
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

  useEffect(() => {
    if (focus === "overview") return;
    const section = document.getElementById(`section-${focus}`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  const headline = useMemo(
    () => ({
      referenceTimestamp: facts.referenceTimestamp,
      carbon: {
        value: facts.carbon.value,
        timestamp: facts.carbon.periodStartUtc,
        index: facts.carbon.index,
      },
      demand: {
        value: facts.demand.value,
        timestamp: facts.demand.periodStartUtc,
      },
      price: {
        value: facts.price.value,
        timestamp: facts.price.periodStartUtc,
      },
      mixSnapshot: facts.mixSnapshot,
    }),
    [facts]
  );
  const rangeSummary = useMemo(
    () => buildRangeSummary(initialSnapshots),
    [initialSnapshots]
  );
  const latestGenerationSplit = useMemo(
    () => splitLatestGenerationRows(facts.generationRows),
    [facts.generationRows]
  );

  const latestMixData = headline.mixSnapshot ? mixFromSnapshot(headline.mixSnapshot) : {};
  const carbonAsOf = headlineAsOf(headline.carbon.timestamp, headline.referenceTimestamp);
  const demandAsOf = headlineAsOf(headline.demand.timestamp, headline.referenceTimestamp);
  const priceAsOf = headlineAsOf(headline.price.timestamp, headline.referenceTimestamp);
  const mixAsOf = headlineAsOf(
    headline.mixSnapshot?.timestamp ?? null,
    headline.referenceTimestamp
  );

  const topSources = useMemo(
    () =>
      [...latestGenerationSplit.sources].sort(
        (left, right) => right.generation_mw - left.generation_mw
      ),
    [latestGenerationSplit.sources]
  );
  const topSource = topSources[0] ?? null;

  const commodityStats = useMemo(() => {
    const groups = new Map<string, CommodityPrice[]>();
    for (const price of initialPrices) {
      if (!groups.has(price.commodity)) {
        groups.set(price.commodity, []);
      }
      groups.get(price.commodity)!.push(price);
    }

    return Array.from(groups.entries())
      .sort(([left], [right]) => commodityDisplayIndex(left) - commodityDisplayIndex(right))
      .map(([commodity, rows]) => {
      const sortedRows = [...rows].sort(
        (left, right) =>
          new Date(left.date).getTime() - new Date(right.date).getTime()
      );
      const first = sortedRows[0];
      const latest = sortedRows[sortedRows.length - 1];
      const absoluteDelta = latest ? latest.price - first.price : 0;
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

  const carbonDelta = rangeSummary.carbon.deltaFromAverage ?? 0;
  const demandDelta = rangeSummary.demand.deltaFromAverage ?? 0;
  const priceDelta = rangeSummary.price.deltaFromAverage ?? 0;
  const transferStance = transferStanceFrom(facts.netImportsMw.value);
  const activeInterconnectors = latestGenerationSplit.interconnectors.filter(
    (row) => Math.abs(row.generation_mw) >= 25
  ).length;
  const importShare =
    transferStance.kind !== "unknown" &&
    headline.demand.value != null &&
    headline.demand.value > 0
      ? (transferStance.mw / headline.demand.value) * 100
      : null;

  const briefingLine = [
    carbonDelta < 0
      ? `Carbon is ${Math.abs(carbonDelta)} g cleaner than the ${range} average`
      : carbonDelta > 0
        ? `Carbon is ${carbonDelta} g above the ${range} average`
        : `Carbon is tracking the ${range} average`,
    topSource
      ? `${formatFuelLabel(topSource.fuel_type)} leads supply at ${formatGigawatts(
          topSource.generation_mw
        )} GW`
      : "Generation leadership is unavailable",
    transferBriefing(transferStance),
  ].join(", ");

  const insightCards = [
    {
      title: "Carbon stance",
      value:
        carbonDelta === 0
          ? "In line"
          : carbonDelta < 0
            ? `${Math.abs(carbonDelta)} g cleaner`
            : `${carbonDelta} g hotter`,
      detail: `Range low ${formatOptionalNumber(rangeSummary.carbon.min)} g · high ${formatOptionalNumber(rangeSummary.carbon.max)} g`,
      tone: carbonDelta <= 0 ? "emerald" : "amber",
      icon: <Wind className="w-4 h-4" />,
    },
    {
      title: "Demand pressure",
      value:
        demandDelta === 0
          ? "At trend"
          : demandDelta > 0
            ? `${formatGigawatts(demandDelta)} GW above`
            : `${formatGigawatts(Math.abs(demandDelta))} GW below`,
      detail: `Peak ${formatOptionalGw(rangeSummary.demand.max)} GW · low ${formatOptionalGw(
        rangeSummary.demand.min
      )} GW`,
      tone: demandDelta > 0 ? "blue" : "sky",
      icon: <Activity className="w-4 h-4" />,
    },
    {
      title: "Price regime",
      value:
        priceDelta === 0
          ? "At trend"
          : priceDelta > 0
            ? `£${priceDelta} above avg`
            : `£${Math.abs(priceDelta)} below avg`,
      detail: `Range £${formatOptionalNumber(rangeSummary.price.min)} to £${formatOptionalNumber(rangeSummary.price.max)}/MWh`,
      tone: priceDelta > 0 ? "rose" : "emerald",
      icon: <Zap className="w-4 h-4" />,
    },
    {
      title: "Import dependency",
      value: transferInsightValue(transferStance, importShare),
      detail:
        transferStance.kind === "unknown"
          ? "No interconnector observations"
          : `${activeInterconnectors} active links in the latest dispatch frame`,
      tone: transferStance.kind === "export" ? "violet" : "cyan",
      icon: <ArrowLeftRight className="w-4 h-4" />,
    },
  ] as const;

  const hasSnapshots = initialSnapshots.length > 0;
  const hasLatestGeneration = latestGenerationSplit.sources.length > 0;
  const hasInterconnectorHistory = generationHistory.some((row) =>
    normalizeFuelType(row.fuel_type).startsWith("int")
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070f] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-12%] h-80 w-80 rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute right-[-12%] top-[12%] h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-16%] left-[20%] h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_42%),linear-gradient(180deg,rgba(8,15,30,0.88),rgba(4,7,15,1))]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050915]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/12">
                <Zap className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/70">
                  Operations Briefing
                </p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  Grid
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  {facts.headerStamp}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TimeRangeSelector
              value={range}
              onChange={(nextRange) => {
                void setUrlState({
                  range: nextRange,
                  date: dateParamForRange(
                    nextRange,
                    urlState.date ?? searchParams.date
                  ),
                });
              }}
              options={GLOBAL_RANGE_OPTIONS}
              pending={isPending}
            />
            {range === "24h" ? (
              <label className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-zinc-200">
                <CalendarDays className="h-4 w-4 text-emerald-200" />
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                  Date
                </span>
                <input
                  type="date"
                  value={activeDate}
                  min={facts.coverageStart}
                  max={todayDate}
                  onChange={(event) => {
                    void setUrlState({ date: event.target.value || todayDate });
                  }}
                  disabled={isPending}
                  className="min-w-[9.5rem] bg-transparent text-sm text-zinc-100 outline-none [color-scheme:dark]"
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => startTransition(() => router.refresh())}
              disabled={isPending}
              className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Share view"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section
          id="section-overview"
          className="relative grid gap-5 rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur sm:p-6 lg:grid-cols-[1.5fr_1fr]"
        >
          {isPending ? (
            <OverviewSectionSkeleton />
          ) : facts.empty && facts.emptyState ? (
            <div className="rounded-lg border border-zinc-700/80 p-6 text-sm text-zinc-300 lg:col-span-2">
              <p>{facts.emptyState.message}</p>
              <a
                href={facts.emptyState.href}
                className="mt-4 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
              >
                {facts.emptyState.action}
              </a>
            </div>
          ) : (
            <>
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label="GB grid + market context" tone="emerald" />
                  <Badge label="Shareable URL state" tone="sky" />
                  <Badge label={`${range} power view`} tone="violet" />
                  <Badge label={`${commodityRange} commodity view`} tone="amber" />
                </div>

                <div className="space-y-3">
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                    Britain&apos;s electricity system, recut as a live briefing instead of a card wall.
                  </h2>
                  <p className="max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
                    {briefingLine}. The top layer explains what matters now; the deeper sections keep the raw
                    curves, source mix, transfer behavior, and commodity context available for power users.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <HeroFact
                    label="Current carbon"
                    value={
                      headline.carbon.value != null
                        ? `${Math.round(headline.carbon.value)} gCO₂/kWh`
                        : "—"
                    }
                    detail={
                      headline.carbon.index
                        ? `${headline.carbon.index} · avg ${formatOptionalNumber(rangeSummary.carbon.average)} g`
                        : "Awaiting data"
                    }
                    asOf={carbonAsOf}
                  />
                  <HeroFact
                    label="Domestic generation"
                    value={
                      facts.generationMw.value == null
                        ? "—"
                        : `${formatHeadlineGw(facts.generationMw.value)} GW`
                    }
                    detail={
                      topSource
                        ? `${formatFuelLabel(topSource.fuel_type)} leading`
                        : "Awaiting latest dispatch"
                    }
                  />
                  <HeroFact
                    label="Transfer stance"
                    value={transferHeroValue(transferStance)}
                    detail={
                      transferStance.kind === "unknown"
                        ? "No interconnector observations"
                        : `${activeInterconnectors} active interconnectors`
                    }
                  />
                  <HeroFact
                    label="Imbalance price"
                    value={
                      headline.price.value != null
                        ? `£${Math.round(headline.price.value)}/MWh`
                        : "—"
                    }
                    detail={`Range avg £${formatOptionalNumber(rangeSummary.price.average)}/MWh`}
                    asOf={priceAsOf}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {insightCards.map((card) => (
                  <InsightCard key={card.title} {...card} />
                ))}
              </div>
            </>
          )}
        </section>

        {facts.empty && !isPending ? null : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {isPending ? (
            <KpiGridSkeleton />
          ) : (
            <>
              <KpiCard
                label="Carbon Intensity"
                value={
                  headline.carbon.value != null
                    ? String(Math.round(headline.carbon.value))
                    : "—"
                }
                unit="gCO₂/kWh"
                detail={
                  headline.carbon.index
                    ? `${headline.carbon.index} · ${formatSignedNumber(carbonDelta)} vs avg`
                    : undefined
                }
                asOf={carbonAsOf}
                color={
                  headline.carbon.index ? carbonIndexColor(headline.carbon.index) : undefined
                }
                icon={<Wind className="h-3.5 w-3.5" />}
                tooltip="Current carbon intensity, benchmarked against the selected window average."
              />
              <KpiCard
                label="Demand"
                value={
                  headline.demand.value != null
                    ? formatGigawatts(headline.demand.value)
                    : "—"
                }
                unit="GW"
                detail={`${formatSignedNumber(formatGigawattsNumber(demandDelta))} vs avg`}
                asOf={demandAsOf}
                icon={<Activity className="h-3.5 w-3.5" />}
                tooltip="Transmission demand right now versus the selected window."
              />
              <KpiCard
                label="Domestic Supply"
                value={formatHeadlineGw(facts.generationMw.value)}
                unit="GW"
                detail={
                  topSource ? `${formatFuelLabel(topSource.fuel_type)} leading` : "Awaiting dispatch"
                }
                icon={<Gauge className="h-3.5 w-3.5" />}
                tooltip="Latest domestic generation across fuel and embedded renewable sources."
              />
              <KpiCard
                label="Net Transfers"
                value={transferKpiValue(transferStance)}
                unit="GW"
                detail={transferKpiDetail(transferStance)}
                color={
                  transferStance.kind === "export" ? "#f97316" : "#34d399"
                }
                icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
                tooltip="Net import/export stance based on the latest interconnector frame."
              />
              <KpiCard
                label="Imbalance Price"
                value={
                  headline.price.value != null
                    ? `£${Math.round(headline.price.value)}`
                    : "—"
                }
                unit="/MWh"
                detail={`${formatSignedNumber(priceDelta)} vs avg`}
                asOf={priceAsOf}
                icon={<Zap className="h-3.5 w-3.5" />}
                tooltip="Elexon imbalance cash-out (system buy) price versus the selected range average. This is not the day-ahead wholesale price."
              />
            </>
          )}
        </section>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            id="section-carbon"
            title="Carbon pulse"
            icon={<Wind className="h-4 w-4 text-emerald-300" />}
            tooltip="How clean the grid is through the selected window, with forecast context."
            active={focus === "carbon"}
          >
            {isPending ? (
              <ChartSectionSkeleton heightClassName="h-64" />
            ) : hasSnapshots ? (
              <CarbonIntensityChart data={initialSnapshots} range={range} />
            ) : (
              <EmptyState label="No carbon data available" />
            )}
          </SectionCard>

          <SectionCard
            id="section-price"
            title="Imbalance price"
            icon={<Zap className="h-4 w-4 text-amber-300" />}
            tooltip="GB imbalance cash-out (system buy) price over the selected window. Negative prices are real."
            active={focus === "price"}
          >
            {isPending ? (
              <ChartSectionSkeleton heightClassName="h-64" />
            ) : hasSnapshots ? (
              <ElectricityPriceChart data={initialSnapshots} range={range} />
            ) : (
              <EmptyState label="No price data available" />
            )}
          </SectionCard>

          <SectionCard
            id="section-generation"
            title="Generation desk"
            icon={<Layers3 className="h-4 w-4 text-sky-300" />}
            tooltip="Current supply stack plus demand coverage, with source-by-source context."
            active={focus === "generation"}
            fullWidth
          >
            {isPending ? (
              <GenerationDeskSkeleton />
            ) : hasSnapshots && hasLatestGeneration ? (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <DemandBalanceChart data={initialSnapshots} range={range} />
                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                          Latest mix
                        </p>
                        <InfoTooltip text="Uses the latest snapshot percentages to keep high-level categories stable across ranges." />
                        {mixAsOf ? (
                          <p className="text-[11px] tabular-nums text-zinc-500">as of {mixAsOf}</p>
                        ) : null}
                      </div>
                      <GenerationMixChart data={latestMixData} />
                    </div>
                    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                            By source
                          </p>
                          <p className="mt-1 text-sm text-zinc-300">
                            Dispatch scaled against current demand.
                          </p>
                        </div>
                      </div>
                      <GenerationTable
                        data={latestGenerationSplit.sources}
                        demandMw={headline.demand.value}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-blue-300" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Demand profile
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        Demand path for the selected power window.
                      </p>
                    </div>
                  </div>
                  <DemandChart data={initialSnapshots} range={range} />
                </div>
              </div>
            ) : (
              <EmptyState label="No generation data available" />
            )}
          </SectionCard>

          <SectionCard
            title="Generation mix over time"
            icon={<LineChart className="h-4 w-4 text-cyan-300" />}
            tooltip="How the generation stack shifts through the selected range, including embedded solar and wind."
            fullWidth
          >
            {isPending ? (
              <ChartSectionSkeleton heightClassName="h-72" fullWidth />
            ) : generationHistory.length > 0 ? (
              <GenerationStackChart data={generationHistory} range={range} />
            ) : (
              <EmptyState label="No generation history available" />
            )}
          </SectionCard>

          <SectionCard
            id="section-transfers"
            title="Transmission desk"
            icon={<ArrowLeftRight className="h-4 w-4 text-cyan-300" />}
            tooltip="Current interconnector stance plus connector-level history."
            active={focus === "transfers"}
            fullWidth
          >
            {isPending ? (
              <TransfersDeskSkeleton />
            ) : hasInterconnectorHistory ? (
              <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                      Latest connector book
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Positive bars are imports into Great Britain.
                    </p>
                  </div>
                  <InterconnectorChart data={latestGenerationSplit.interconnectors} />
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                      Connector history
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Each line is one link, making import/export swings visible without losing per-link detail.
                    </p>
                  </div>
                  <InterconnectorFlowsChart data={generationHistory} range={range} />
                </div>
              </div>
            ) : (
              <EmptyState label="No interconnector history available" />
            )}
          </SectionCard>

          <SectionCard
            id="section-commodities"
            title="Commodity desk"
            icon={<Droplets className="h-4 w-4 text-amber-300" />}
            tooltip="Oil and gas context with its own slower market horizon."
            active={focus === "commodities"}
            fullWidth
            headerRight={
              <TimeRangeSelector
                value={commodityRange}
                onChange={(nextRange) => {
                  void setUrlState({ commodityRange: nextRange });
                }}
                options={COMMODITY_RANGE_OPTIONS}
                pending={isPending}
                compact
              />
            }
          >
            {isPending ? (
              <CommodityDeskSkeleton />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {commodityStats.map(({ commodity }) => {
                    const active = selectedCommodities.includes(commodity);
                    return (
                      <button
                        key={commodity}
                        type="button"
                        onClick={() => {
                          setSelectedCommodities((current) => {
                            if (current.includes(commodity)) {
                              return current.length === 1
                                ? current
                                : current.filter((value) => value !== commodity);
                            }
                            return [...current, commodity];
                          });
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-white/20 text-white"
                            : "border-white/8 text-zinc-400 hover:text-zinc-100"
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: `${COMMODITY_COLORS[commodity] ?? "#64748b"}20`,
                                borderColor: `${COMMODITY_COLORS[commodity] ?? "#64748b"}66`,
                              }
                            : undefined
                        }
                      >
                        {COMMODITY_LABELS[commodity] ?? commodity}
                      </button>
                    );
                  })}
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {commodityStats.map(({ commodity, latest, absoluteDelta, percentageDelta }) =>
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
                    selectedSeries={selectedCommodities}
                  />
                ) : (
                  <EmptyState label="No commodity data available" />
                )}
              </>
            )}
          </SectionCard>
        </div>

        <footer className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                Methodology
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-300">
                Grid metrics are refreshed from Carbon Intensity API, Elexon BMRS, NESO embedded wind, and
                Sheffield Solar PV Live. The power price is the Elexon imbalance (cash-out) price, not
                day-ahead wholesale. Oil and gas prices come from EIA (US Energy Information Administration)
                and National Gas, and refresh every 6 hours. Power and market ranges are intentionally
                decoupled because intraday grid behavior and commodity settlement cadence move on different
                clocks.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                <code className="rounded-full border border-white/8 bg-black/20 px-3 py-1">
                  GET /api/snapshots?range={range}
                </code>
                <code className="rounded-full border border-white/8 bg-black/20 px-3 py-1">
                  GET /api/generation?range={range}
                </code>
                <code className="rounded-full border border-white/8 bg-black/20 px-3 py-1">
                  GET /api/prices?range={commodityRange}
                </code>
              </div>
              <p className="text-xs text-zinc-500">
                URL state is canonical for the selected range, commodity horizon, and section focus. Rate limit remains 60 requests per minute.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function SectionCard({
  id,
  title,
  icon,
  tooltip,
  headerRight,
  children,
  fullWidth = false,
  active = false,
}: {
  id?: string;
  title: string;
  icon?: React.ReactNode;
  tooltip?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
  active?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative min-w-0 rounded-[28px] border bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] ${
        fullWidth ? "xl:col-span-2" : ""
      } ${
        active
          ? "border-emerald-300/30 shadow-[0_24px_80px_rgba(16,185,129,0.12)]"
          : "border-white/10"
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
              {icon}
            </div>
          ) : null}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
              {tooltip ? <InfoTooltip text={tooltip} /> : null}
            </div>
          </div>
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function OverviewSectionSkeleton() {
  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-3xl" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-3/4 max-w-2xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <HeroFactSkeleton key={`hero-${index}`} />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <InsightCardSkeleton key={`insight-${index}`} />
        ))}
      </div>
    </>
  );
}

function KpiGridSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <KpiCardSkeleton key={`kpi-${index}`} />
      ))}
    </>
  );
}

function ChartSectionSkeleton({
  heightClassName,
  fullWidth = false,
}: {
  heightClassName: string;
  fullWidth?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Skeleton className={`${heightClassName} w-full rounded-[24px]`} />
      <div className={`grid gap-3 ${fullWidth ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {Array.from({ length: fullWidth ? 3 : 2 }).map((_, index) => (
          <Skeleton key={`chart-detail-${index}`} className="h-10 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function GenerationDeskSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <Skeleton className="h-80 w-full rounded-[24px]" />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-3 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-72 w-full rounded-[24px]" />
          </div>
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-3 space-y-2">
              <Skeleton className="h-3 w-18" />
              <Skeleton className="h-3 w-44" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`source-row-${index}`} className="grid grid-cols-[1.5fr_0.7fr_0.8fr] gap-3">
                  <Skeleton className="h-4 w-full rounded-lg" />
                  <Skeleton className="h-4 w-full rounded-lg" />
                  <Skeleton className="h-4 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <div className="mb-3 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-64 w-full rounded-[24px]" />
      </div>
    </div>
  );
}

function TransfersDeskSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <div className="mb-3 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-52" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`connector-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28 rounded-lg" />
                <Skeleton className="h-4 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <div className="mb-3 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-72 w-full rounded-[24px]" />
      </div>
    </div>
  );
}

function CommodityDeskSkeleton() {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={`commodity-chip-${index}`} className="h-8 w-32 rounded-full" />
        ))}
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <CommodityStatCardSkeleton key={`commodity-stat-${index}`} />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-[24px]" />
    </>
  );
}

function HeroFactSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-36" />
    </div>
  );
}

function InsightCardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-2 h-3 w-40" />
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

function CommodityStatCardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

function InsightCard({
  title,
  value,
  detail,
  tone,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "blue" | "sky" | "rose" | "cyan" | "violet";
  icon: React.ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    emerald: "border-emerald-400/20 bg-emerald-400/[0.08]",
    amber: "border-amber-400/20 bg-amber-400/[0.08]",
    blue: "border-blue-400/20 bg-blue-400/[0.08]",
    sky: "border-sky-400/20 bg-sky-400/[0.08]",
    rose: "border-rose-400/20 bg-rose-400/[0.08]",
    cyan: "border-cyan-400/20 bg-cyan-400/[0.08]",
    violet: "border-violet-400/20 bg-violet-400/[0.08]",
  };

  return (
    <div className={`rounded-3xl border p-4 ${toneClasses[tone]}`}>
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-300">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{detail}</p>
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
  const deltaColor = rising ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          {COMMODITY_CARD_LABELS[commodity] ?? COMMODITY_LABELS[commodity] ?? commodity}
        </p>
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: COMMODITY_COLORS[commodity] ?? "#64748b" }}
        />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {latest ? formatCommodityPrice(latest) : "—"}
      </p>
      <div className={`mt-2 flex items-center gap-1 text-sm ${deltaColor}`}>
        {rising ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span>
          {formatSignedCurrency(absoluteDelta, latest?.currency)} · {formatSignedPercentage(percentageDelta)}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{latest ? normalizeUnit(latest.unit) : "No current value"}</p>
    </div>
  );
}

function HeroFact({
  label,
  value,
  detail,
  asOf,
}: {
  label: string;
  value: string;
  detail: string;
  asOf?: string | null;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      {asOf ? (
        <p className="mt-1 text-[11px] tabular-nums text-zinc-500">as of {asOf}</p>
      ) : null}
      <p className="mt-3 text-xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-zinc-400">{detail}</p>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "emerald" | "sky" | "violet" | "amber" }) {
  const toneMap: Record<string, string> = {
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    sky: "border-sky-300/25 bg-sky-300/10 text-sky-100",
    violet: "border-violet-300/25 bg-violet-300/10 text-violet-100",
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${toneMap[tone]}`}>
      {label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/15 text-sm text-zinc-500">
      {label}
    </div>
  );
}

function mixFromSnapshot(snapshot: EnergySnapshot): Record<string, number> {
  const entries: Array<[string, number | null]> = [
    ["gas", snapshot.gen_gas_pct],
    ["coal", snapshot.gen_coal_pct],
    ["nuclear", snapshot.gen_nuclear_pct],
    ["wind", snapshot.gen_wind_pct],
    ["solar", snapshot.gen_solar_pct],
    ["hydro", snapshot.gen_hydro_pct],
    ["biomass", snapshot.gen_biomass_pct],
    ["imports", snapshot.gen_imports_pct],
    ["other", snapshot.gen_other_pct],
  ];

  const mix: Record<string, number> = {};
  for (const [fuel, value] of entries) {
    if (value != null) {
      mix[fuel] = value;
    }
  }
  return mix;
}

type TransferStance =
  | { kind: "unknown" }
  | { kind: "balanced"; mw: number }
  | { kind: "import"; mw: number }
  | { kind: "export"; mw: number };

function transferStanceFrom(netImportsMw: number | null): TransferStance {
  if (netImportsMw == null) {
    return { kind: "unknown" };
  }
  if (Math.abs(netImportsMw) < 25) {
    return { kind: "balanced", mw: netImportsMw };
  }
  return netImportsMw > 0
    ? { kind: "import", mw: netImportsMw }
    : { kind: "export", mw: netImportsMw };
}

function transferBriefing(stance: TransferStance): string {
  switch (stance.kind) {
    case "unknown":
      return "cross-border transfer stance is unknown";
    case "balanced":
      return "cross-border flows are broadly balanced";
    case "import":
      return `Britain is importing ${formatGigawatts(stance.mw, 2)} GW`;
    case "export":
      return `Britain is exporting ${formatGigawatts(Math.abs(stance.mw), 2)} GW`;
    default: {
      const exhaustive: never = stance;
      return exhaustive;
    }
  }
}

function transferHeroValue(stance: TransferStance): string {
  switch (stance.kind) {
    case "unknown":
      return "Unknown";
    case "balanced":
      return "Balanced";
    case "import":
    case "export":
      return `${formatGigawatts(Math.abs(stance.mw), 2)} GW ${stance.kind}`;
    default: {
      const exhaustive: never = stance;
      return exhaustive;
    }
  }
}

function transferInsightValue(stance: TransferStance, importShare: number | null): string {
  switch (stance.kind) {
    case "unknown":
      return "Unknown";
    case "balanced":
      return "Balanced";
    case "import":
    case "export":
      if (importShare == null) {
        return stance.kind;
      }
      return `${formatSignedPercentage(importShare)} of demand`;
    default: {
      const exhaustive: never = stance;
      return exhaustive;
    }
  }
}

function transferKpiValue(stance: TransferStance): string {
  switch (stance.kind) {
    case "unknown":
      return "—";
    case "balanced":
      return "0.00";
    case "import":
    case "export":
      return formatGigawatts(Math.abs(stance.mw), 2);
    default: {
      const exhaustive: never = stance;
      return exhaustive;
    }
  }
}

function transferKpiDetail(stance: TransferStance): string {
  switch (stance.kind) {
    case "unknown":
      return "unknown";
    case "balanced":
    case "import":
    case "export":
      return stance.kind;
    default: {
      const exhaustive: never = stance;
      return exhaustive;
    }
  }
}

function formatOptionalNumber(value: number | null): string {
  return value == null ? "—" : String(value);
}

function formatOptionalGw(value: number | null): string {
  return value == null ? "—" : formatGigawatts(value);
}

function formatCommodityPrice(latest: CommodityPrice): string {
  const symbol = latest.currency === "EUR" ? "€" : latest.currency === "GBP" ? "£" : "$";
  return `${symbol}${latest.price.toFixed(2)}`;
}

function formatFuelLabel(fuelType: string): string {
  return FUELINST_LABELS[normalizeFuelType(fuelType)] ?? fuelType.toUpperCase();
}

function formatGigawatts(valueMw: number, digits = 1): string {
  return (valueMw / 1000).toFixed(digits);
}

function formatGigawattsNumber(valueMw: number, digits = 1): number {
  return Number(formatGigawatts(valueMw, digits));
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

function formatSignedNumber(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}

function normalizeUnit(unit: string): string {
  return unit.replace("BBL", "bbl").replace("MMBTU", "MMBtu");
}
