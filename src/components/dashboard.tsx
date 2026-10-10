"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { CommodityPrice, CommodityRange, EnergySnapshot, Generation5min } from "@/lib/types";
import {
  CARBON_INTENSITY_API_URL,
  CARBON_INTENSITY_ATTRIBUTION,
  elexonBmrsAttribution,
  ELEXON_BMRS_LICENCE_URL,
  NESO_HISTORIC_MIX_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
} from "@/lib/attribution";
import {
  formatGridFetchedAt,
  lookAheadFromPublic,
  showsCarbonForecast,
  showsLookAheadCopy,
} from "@/lib/forecast-model";
import {
  dashboardSearchParamParsers,
  getDashboardCoverageStart,
  resolveDashboardDate,
} from "@/lib/dashboard-search-params";
import {
  chartRangeForPeriod,
  isNesoPeriod,
  searchStateForPeriod,
  selectedPeriod,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import {
  adjacentPeriods,
  blockPeriodParam,
  dashboardQueryKey,
  effectiveBlockPeriod,
  PERIOD_OPTIONS,
  pricesQueryKey,
  type DashboardBlock,
} from "@/lib/dashboard-blocks";
import { fetchDashboardPayload, fetchPublicPrices } from "@/lib/dashboard-client";
import { prefetchQuery, revalidateAllQueries } from "@/lib/client-query";
import { useClientQuery } from "@/lib/use-client-query";
import { PeriodAveragesRow } from "@/components/period-averages";
import { RecordsCard } from "@/components/records-card";
import { EnergyTransition } from "@/components/energy-transition";
import { snapshotPeriodAverages } from "@/lib/period-averages";
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
import {
  generationSharesFromRows,
  normalizeFuelType,
  splitLatestGenerationRows,
} from "@/lib/dashboard-model";
import { getLatestFacts } from "@/lib/facts";
import { getLondonDate } from "@/lib/london-time";
import { GenerationDesk, GenerationDeskSkeleton } from "@/components/generation-desk";
import { SectionBlock } from "@/components/section-block";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { SiteHeader } from "@/components/site-header";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { GbGasSapCard } from "@/components/gb-gas-sap-card";
import { Card, CardEmpty, CardError, CardLoading, PAGE_STACK_CLASS } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CarbonIntensityChart } from "@/components/charts/carbon-intensity-chart";
import { ElectricityPriceChart } from "@/components/charts/price-chart";
import { GenerationStackChart } from "@/components/charts/generation-stack-chart";
import { CommodityChart } from "@/components/charts/commodity-chart";
import { InterconnectorChart } from "@/components/charts/interconnector-chart";
import { InterconnectorFlowsChart } from "@/components/charts/interconnector-flows-chart";
const COMMODITY_RANGE_OPTIONS = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
] as const;

const PRICE_SERIES_OPTIONS = [
  { value: "mid", label: "Market" },
  { value: "system", label: "System" },
] as const;

const EMPTY_SNAPSHOTS: EnergySnapshot[] = [];
const EMPTY_GENERATION: Generation5min[] = [];
const EMPTY_PRICES: CommodityPrice[] = [];

const COMMODITY_HELP: Record<string, string> = {
  brent_crude: "North Sea crude oil benchmark. Source: US EIA.",
  henry_hub_gas: "US natural gas benchmark. Source: US EIA.",
  gb_gas_sap: "Great Britain System Average Price for gas. Source: National Gas.",
};

function queryDateForPeriod(period: DashboardPeriod, date: string | null, today: string): string | null {
  if (period !== "day" || !date || date === today) {
    return null;
  }
  return date;
}

export function Dashboard() {
  const [copied, setCopied] = useState(false);
  const [urlState, setUrlState] = useQueryStates(dashboardSearchParamParsers, {
    history: "replace",
    shallow: true,
    scroll: false,
  });

  const [now, setNow] = useState(() => new Date());
  const todayDate = getLondonDate(now);
  const range = urlState.range;
  const period = selectedPeriod(urlState.period, range) ?? "day";
  const commodityRange = urlState.commodityRange;
  const focus = urlState.focus;
  const priceSeries = urlState.price;
  const activeDate = urlState.date ?? todayDate;

  const generationPeriod = effectiveBlockPeriod(period, urlState.generationPeriod);
  const pricePeriod = effectiveBlockPeriod(period, urlState.pricePeriod);
  const transfersPeriod = effectiveBlockPeriod(period, urlState.transfersPeriod);
  const mixPeriod = effectiveBlockPeriod(period, urlState.mixPeriod);
  const carbonPeriod = effectiveBlockPeriod(period, urlState.carbonPeriod);

  const generation = useDashboardPeriod(
    generationPeriod,
    queryDateForPeriod(generationPeriod, urlState.date, todayDate)
  );
  const price = useDashboardPeriod(
    pricePeriod,
    queryDateForPeriod(pricePeriod, urlState.date, todayDate)
  );
  const transfers = useDashboardPeriod(
    transfersPeriod,
    queryDateForPeriod(transfersPeriod, urlState.date, todayDate)
  );
  const mix = useDashboardPeriod(
    mixPeriod,
    queryDateForPeriod(mixPeriod, urlState.date, todayDate)
  );
  const carbon = useDashboardPeriod(
    carbonPeriod,
    queryDateForPeriod(carbonPeriod, urlState.date, todayDate)
  );
  const fetchPrices = useCallback(() => fetchPublicPrices(commodityRange), [commodityRange]);
  const pricesQuery = useClientQuery(pricesQueryKey(commodityRange), fetchPrices);

  const generationData = generation.data;
  const priceData = price.data;
  const transfersData = transfers.data;
  const mixData = mix.data;
  const carbonData = carbon.data;
  const shared = generationData ?? priceData ?? transfersData ?? mixData ?? carbonData;
  const facts = generationData?.facts ?? fallbackFacts(now);
  const headlineSnapshots = generationData?.headlineSnapshots ?? EMPTY_SNAPSHOTS;
  const headlineGeneration = generationData?.headlineGeneration ?? EMPTY_GENERATION;
  const initialSnapshots = generationData?.snapshots ?? EMPTY_SNAPSHOTS;
  const generationHistory = generationData?.generationHistory ?? EMPTY_GENERATION;
  const lookAhead = lookAheadFromPublic(shared?.lookAhead ?? null);
  const records = shared?.records ?? null;
  const historicView = generationData?.historicView ?? null;
  const transitionView = shared?.transitionView ?? generationData?.historicView ?? null;
  const initialPrices = pricesQuery.data ?? EMPTY_PRICES;
  const chartRange = chartRangeForPeriod(generationPeriod, range);
  const neso = isNesoPeriod(generationPeriod);
  const power = getDisplayedPower(facts, headlineSnapshots);
  const averages = historicView?.averages ?? snapshotPeriodAverages(initialSnapshots);
  const isPending = generation.isValidating || price.isValidating || transfers.isValidating || mix.isValidating || carbon.isValidating;

  useEffect(() => {
    if (focus === "overview") return;
    const section = document.getElementById(`section-${focus}`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        revalidateAllQueries();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const periods = new Set<DashboardPeriod>([
      period,
      generationPeriod,
      pricePeriod,
      transfersPeriod,
      mixPeriod,
      carbonPeriod,
    ]);
    const toPrefetch = new Set<DashboardPeriod>();
    for (const current of periods) {
      for (const next of adjacentPeriods(current)) {
        toPrefetch.add(next);
      }
    }

    const run = () => {
      for (const next of toPrefetch) {
        prefetchPeriod(next, queryDateForPeriod(next, urlState.date, todayDate));
      }
      prefetchQuery(pricesQueryKey(commodityRange), () => fetchPublicPrices(commodityRange));
    };

    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run);
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 200);
    return () => window.clearTimeout(id);
  }, [
    period,
    generationPeriod,
    pricePeriod,
    transfersPeriod,
    mixPeriod,
    carbonPeriod,
    commodityRange,
    urlState.date,
    todayDate,
  ]);

  const generationRows = power.generationRows;
  const topShare = (() => {
    const shares = generationSharesFromRows(generationRows);
    if (shares.length === 0) {
      return null;
    }
    return [...shares].sort((left, right) => right.mw - left.mw)[0] ?? null;
  })();

  const answer = buildAnswerSentence({
    topFuel: topShare?.fuel ?? null,
    topMw: topShare?.mw ?? null,
    topSharePct: topShare?.sharePct ?? null,
    transfersMw: power.transfersMw,
    empty: facts.empty,
    horizon: generationPeriod === "year" || generationPeriod === "all" ? generationPeriod : "live",
  });

  const commodityStats = useMemo(() => {
    const groups = new Map<string, CommodityPrice[]>();
    for (const priceRow of initialPrices) {
      if (!groups.has(priceRow.commodity)) {
        groups.set(priceRow.commodity, []);
      }
      groups.get(priceRow.commodity)?.push(priceRow);
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

  const priceSnapshots = priceData?.snapshots ?? EMPTY_SNAPSHOTS;
  const priceNeso = isNesoPeriod(pricePeriod);
  const priceChartRange = chartRangeForPeriod(pricePeriod, range);
  const transfersHistory = transfersData?.generationHistory ?? EMPTY_GENERATION;
  const transfersNeso = isNesoPeriod(transfersPeriod);
  const transfersChartRange = chartRangeForPeriod(transfersPeriod, range);
  const mixHistory = mixData?.generationHistory ?? EMPTY_GENERATION;
  const mixChartRange = chartRangeForPeriod(mixPeriod, range);
  const carbonSnapshots = carbonData?.snapshots ?? EMPTY_SNAPSHOTS;
  const carbonFacts = carbonData?.facts ?? facts;
  const carbonChartRange = chartRangeForPeriod(carbonPeriod, range);
  const carbonLookAhead = lookAheadFromPublic(carbonData?.lookAhead ?? null) ?? lookAhead;
  const hasPriceSnapshots = priceSnapshots.length > 0;
  const hasInterconnectorHistory = transfersHistory.some((row) =>
    normalizeFuelType(row.fuel_type).startsWith("int")
  );
  const latestTransferInterconnectors = splitLatestGenerationRows(
    getDisplayedPower(
      transfersData?.facts ?? facts,
      transfersData?.headlineSnapshots ?? headlineSnapshots
    ).generationRows
  ).interconnectors;

  const setBlockPeriod = (block: DashboardBlock, next: DashboardPeriod) => {
    void setUrlState({ [blockPeriodParam(block)]: next === period ? null : next });
  };

  const prefetchBlock = (next: DashboardPeriod) => {
    prefetchPeriod(next, queryDateForPeriod(next, urlState.date, todayDate));
  };

  return (
    <div className="min-h-screen bg-background-100 text-gray-1000">
      <a
        href="#section-overview"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-md focus:border focus:border-gray-alpha-400 focus:bg-background-100 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <SiteHeader
        period={period}
        onPeriodChange={(nextPeriod) => {
          void setUrlState({
            ...searchStateForPeriod(nextPeriod),
            generationPeriod: urlState.generationPeriod === nextPeriod ? null : urlState.generationPeriod,
            pricePeriod: urlState.pricePeriod === nextPeriod ? null : urlState.pricePeriod,
            transfersPeriod: urlState.transfersPeriod === nextPeriod ? null : urlState.transfersPeriod,
            mixPeriod: urlState.mixPeriod === nextPeriod ? null : urlState.mixPeriod,
            carbonPeriod: urlState.carbonPeriod === nextPeriod ? null : urlState.carbonPeriod,
          });
        }}
        onPeriodIntent={prefetchBlock}
        activeDate={activeDate}
        minDate={getDashboardCoverageStart(now)}
        maxDate={todayDate}
        onDateChange={(date) => {
          void setUrlState({ date: date || todayDate });
        }}
        showDate={period === "day" || (period == null && range === "24h")}
        stamp={facts.headerStamp}
        stale={facts.isStale}
        pending={isPending}
        copied={copied}
        onShare={async () => {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      />

      <main className={PAGE_STACK_CLASS}>
        {generation.error && !generationData ? (
          <Card>
            <CardError>
              Couldn&apos;t load the grid.{" "}
              <button
                type="button"
                className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
                onClick={() => revalidateAllQueries()}
              >
                Retry
              </button>
            </CardError>
          </Card>
        ) : null}
        {facts.empty && facts.emptyState && generationData ? (
          <Card id="section-overview">
            <h1 className="text-heading-32">{answer}</h1>
            <p className="mt-3 text-copy-16 text-gray-900">{facts.emptyState.message}</p>
            <a
              href={facts.emptyState.href}
              className="mt-4 inline-flex h-8 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000"
            >
              {facts.emptyState.action}
            </a>
          </Card>
        ) : (
          <section id="section-overview" className="scroll-mt-28">
            <div className="flex items-center gap-2">
              <p className="text-label-13 text-gray-900">What&apos;s powering Britain</p>
              <InfoTooltip
                text="The live generation mix for Great Britain, including estimated embedded wind and solar. Demand here is the one figure used everywhere on this page."
                label="What is What's powering Britain?"
              />
            </div>
            {generation.isLoading ? (
              <Skeleton className="mt-2 h-10 w-full max-w-3xl" />
            ) : (
              <h1 className="mt-1 text-heading-32 text-gray-1000">{answer}</h1>
            )}
            <Card
              id="section-generation"
              className="mt-4"
              actions={
                <BlockPeriodControl
                  value={generationPeriod}
                  onChange={(next) => setBlockPeriod("generation", next)}
                  onIntent={prefetchBlock}
                />
              }
            >
              {generation.isLoading ? (
                <GenerationDeskSkeleton />
              ) : (
                <>
                  <GenerationDesk
                    facts={facts}
                    snapshots={initialSnapshots}
                    headlineSnapshots={headlineSnapshots}
                    generation={generationHistory}
                    headlineGeneration={headlineGeneration}
                    range={chartRange}
                    pending={generation.isValidating}
                    lookAhead={lookAhead}
                  />
                  <div className="mt-6 border-t border-gray-alpha-400 pt-5">
                    <PeriodAveragesRow averages={averages} neso={neso} />
                  </div>
                </>
              )}
            </Card>
          </section>
        )}

        <SectionBlock
          id="section-price"
          title="What does power cost?"
          tooltip="Market is the short-term wholesale market price from Elexon’s Market Index (APXMIDP). It is not the day-ahead auction price. System is the imbalance (cash-out) price for being long or short in a half-hour."
          active={focus === "price"}
          headerRight={
            <div className="flex flex-wrap items-center gap-3">
              <BlockPeriodControl
                value={pricePeriod}
                onChange={(next) => setBlockPeriod("price", next)}
                onIntent={prefetchBlock}
              />
              <TimeRangeSelector
                value={priceSeries}
                onChange={(nextSeries) => {
                  void setUrlState({ price: nextSeries });
                }}
                options={PRICE_SERIES_OPTIONS}
                compact
                variant="segmented"
                ariaLabel="Price series"
              />
            </div>
          }
        >
          {price.error && !priceData ? (
            <BlockQueryError onRetry={() => revalidateAllQueries()} />
          ) : price.isLoading ? (
            <CardLoading />
          ) : priceNeso ? (
            <p className="text-copy-14 text-gray-900">
              Market prices are not in the NESO historic mix. Use Day or Week for the Market Index.
            </p>
          ) : hasPriceSnapshots ? (
            <ElectricityPriceChart data={priceSnapshots} range={priceChartRange} series={priceSeries} />
          ) : (
            <CardEmpty stamp={facts.headerStamp} />
          )}
        </SectionBlock>

        <SectionBlock
          id="section-transfers"
          title="Where is power flowing?"
          tooltip="Interconnector flows into and out of Great Britain. Positive values are imports."
          active={focus === "transfers"}
          headerRight={
            <BlockPeriodControl
              value={transfersPeriod}
              onChange={(next) => setBlockPeriod("transfers", next)}
              onIntent={prefetchBlock}
            />
          }
        >
          {transfers.error && !transfersData ? (
            <BlockQueryError onRetry={() => revalidateAllQueries()} />
          ) : transfers.isLoading ? (
            <TransfersSkeleton />
          ) : hasInterconnectorHistory ? (
            <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-heading-16 text-gray-1000">Latest flows</h3>
                  <InfoTooltip
                    text={
                      transfersNeso
                        ? "NESO historic mix publishes one imports total, not per-link flows. Supported by National Energy SO Open Data."
                        : "The latest metered flow on each interconnector. Positive is an import into Great Britain. Source: Elexon FUELINST."
                    }
                    label="What is Latest flows?"
                  />
                </div>
                <InterconnectorChart data={latestTransferInterconnectors} />
              </div>
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-heading-16 text-gray-1000">Flows over time</h3>
                  <InfoTooltip
                    text={
                      transfersNeso
                        ? "Imports over the selected historic window. Source: NESO historic generation mix."
                        : "How those interconnector flows moved through the selected window. Source: Elexon FUELINST."
                    }
                    label="What is Flows over time?"
                  />
                </div>
                <InterconnectorFlowsChart data={transfersHistory} range={transfersChartRange} />
              </div>
            </div>
          ) : (
            <CardEmpty stamp={facts.headerStamp} />
          )}
        </SectionBlock>

        <SectionBlock
          title="How has the mix changed?"
          tooltip="How the generation stack shifts through the selected window, including embedded solar and wind."
          headerRight={
            <BlockPeriodControl
              value={mixPeriod}
              onChange={(next) => setBlockPeriod("mix", next)}
              onIntent={prefetchBlock}
            />
          }
        >
          {mix.error && !mixData ? (
            <BlockQueryError onRetry={() => revalidateAllQueries()} />
          ) : mix.isLoading ? (
            <CardLoading />
          ) : mixHistory.length > 0 ? (
            <GenerationStackChart data={mixHistory} range={mixChartRange} />
          ) : (
            <CardEmpty stamp={facts.headerStamp} />
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
              onOptionIntent={(nextRange) => {
                void prefetchQuery(pricesQueryKey(nextRange), () =>
                  fetchPublicPrices(nextRange as CommodityRange)
                );
              }}
              options={COMMODITY_RANGE_OPTIONS}
              compact
              variant="tabs"
              ariaLabel="Commodity range"
            />
          }
        >
          {pricesQuery.error && !pricesQuery.data ? (
            <BlockQueryError onRetry={() => revalidateAllQueries()} />
          ) : pricesQuery.isLoading ? (
            <CommoditySkeleton />
          ) : initialPrices.length > 0 ? (
            <>
              <div className="grid sm:grid-cols-3">
                {commodityCards.map(({ commodity, latest, absoluteDelta, percentageDelta }) => (
                  <div
                    key={commodity}
                    className={
                      commodity === commodityCards[0]?.commodity
                        ? "pb-4 sm:pr-6 sm:pb-0"
                        : "border-t border-gray-alpha-400 py-4 sm:border-t-0 sm:border-l sm:px-6 sm:py-0"
                    }
                  >
                    {commodity === GB_GAS_SAP_COMMODITY ? (
                      <GbGasSapCard
                        latest={latest}
                        absoluteDelta={absoluteDelta}
                        percentageDelta={percentageDelta}
                      />
                    ) : (
                      <CommodityStatCard
                        commodity={commodity}
                        latest={latest}
                        absoluteDelta={absoluteDelta}
                        percentageDelta={percentageDelta}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-gray-alpha-400 pt-5">
                <CommodityChart
                  data={initialPrices}
                  range={commodityRange}
                  selectedSeries={[...PUBLIC_COMMODITIES]}
                />
              </div>
            </>
          ) : (
            <CardEmpty>Oil and gas prices are not available for this range.</CardEmpty>
          )}
        </SectionBlock>

        <SectionBlock
          id="section-records"
          title="Records and the energy transition"
          tooltip="Peaks, firsts and the coal-to-wind shift, computed from NESO historic generation mix. Supported by National Energy SO Open Data."
          active={focus === "records"}
        >
          {shared == null ? (
            <CardLoading className="h-40 sm:h-40" />
          ) : records ? (
            <div className="space-y-8">
              <RecordsCard records={records} />
              <div>
                <h3 className="mb-3 text-heading-16 text-gray-1000">Coal gives way to wind</h3>
                <EnergyTransition
                  yearly={transitionView?.yearly ?? historicView?.yearly ?? []}
                  sentences={transitionView?.sentences ?? historicView?.sentences ?? null}
                />
              </div>
            </div>
          ) : (
            <CardEmpty stamp={facts.headerStamp} />
          )}
        </SectionBlock>

        <SectionBlock
          id="section-carbon"
          title="How clean is it?"
          tooltip="Carbon intensity of GB electricity through the selected window. The line is a single colour; the bands behind it are the official index ranges. The 48-hour forecast is a derived cleanest-window answer from the NESO Carbon Intensity API."
          active={focus === "carbon"}
          headerRight={
            <BlockPeriodControl
              value={carbonPeriod}
              onChange={(next) => setBlockPeriod("carbon", next)}
              onIntent={prefetchBlock}
            />
          }
        >
          {carbon.error && !carbonData ? (
            <BlockQueryError onRetry={() => revalidateAllQueries()} />
          ) : carbon.isLoading ? (
            <CardLoading />
          ) : (
            <>
              {carbonLookAhead?.greenest && showsLookAheadCopy(carbonFacts) ? (
                <div className="mb-4">
                  <p className="text-copy-16 text-gray-1000">{carbonLookAhead.greenest.sentence}</p>
                  <p className="mt-1 text-label-12 text-gray-900">
                    {formatGridFetchedAt(carbonLookAhead.fetchedAt)} · NESO Carbon Intensity API
                  </p>
                </div>
              ) : null}
              {carbonSnapshots.length > 0 ? (
                <CarbonIntensityChart
                  data={carbonSnapshots}
                  range={carbonChartRange}
                  forecast={
                    carbonLookAhead && showsCarbonForecast(carbonChartRange, carbonFacts.isHistorical)
                      ? carbonLookAhead.carbonSeries
                      : []
                  }
                  now={
                    carbonLookAhead && showsCarbonForecast(carbonChartRange, carbonFacts.isHistorical)
                      ? new Date()
                      : null
                  }
                />
              ) : (
                <CardEmpty stamp={facts.headerStamp} />
              )}
            </>
          )}
        </SectionBlock>

        <footer className="border-t border-gray-alpha-400 pt-8 pb-4">
          <h2 className="text-heading-16 text-gray-1000">Sources and methodology</h2>
          <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
            Grid metrics are refreshed from the Carbon Intensity API, Elexon BMRS, NESO embedded
            wind, and Sheffield Solar PV Live. Look-ahead uses the NESO Carbon Intensity 48-hour
            forecast, Elexon WINDFOR, and Elexon NDF, fetched by Grid and cached for 30 minutes.
            Year and All time, plus records, use NESO{" "}
            <a
              href={NESO_HISTORIC_MIX_URL}
              className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              Historic generation mix and carbon intensity
            </a>
            . The headline price is the short-term wholesale market price from Elexon’s Market
            Index (APXMIDP), not the day-ahead auction. System price is the imbalance (cash-out)
            price. Oil and gas prices come from EIA, World Bank Commodity Price Data (The Pink
            Sheet, CC BY 4.0), and National Gas.
          </p>
          <p className="mt-3 max-w-3xl text-copy-14 text-gray-900">
            {elexonBmrsAttribution()}{" "}
            <a
              href={ELEXON_BMRS_LICENCE_URL}
              className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              BMRS Data Licence
            </a>
            . {NESO_OPEN_DATA_ATTRIBUTION}.{" "}
            <a
              href={NESO_OPEN_DATA_LICENCE_URL}
              className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              NESO Open Data Licence
            </a>
            . {CARBON_INTENSITY_ATTRIBUTION}{" "}
            <a
              href={CARBON_INTENSITY_API_URL}
              className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              carbonintensity.org.uk
            </a>
            . Forecast times are when Grid fetched the source, not the publisher’s own stamp.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-mono-12 text-gray-900">
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/dashboard?period={period}
            </code>
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/snapshots?range={range}
            </code>
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/generation?range={range}
            </code>
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/prices?range={commodityRange}
            </code>
            <code className="rounded-md border border-gray-alpha-400 bg-background-200 px-2 py-1">
              GET /api/look-ahead
            </code>
          </div>
          <p className="mt-3 text-label-12 text-gray-900">
            URL state is canonical for the selected period, per-block overrides, commodity horizon,
            and section focus. Range changes use <code>history.replaceState</code> and refetch only
            the affected charts. Share links use <code>?period=year</code> or <code>?period=all</code>
            . Rate limit remains 60 requests per minute.
          </p>
        </footer>
      </main>
    </div>
  );
}

function useDashboardPeriod(period: DashboardPeriod, date: string | null) {
  const fetcher = useCallback(() => fetchDashboardPayload(period, date), [period, date]);
  return useClientQuery(dashboardQueryKey(period, date), fetcher);
}

function prefetchPeriod(period: DashboardPeriod, date: string | null): void {
  void prefetchQuery(dashboardQueryKey(period, date), () => fetchDashboardPayload(period, date));
}

function fallbackFacts(now: Date) {
  return getLatestFacts({
    resolution: resolveDashboardDate(null, now, "24h"),
    snapshots: [],
    generation: [],
    now,
  });
}

function BlockPeriodControl({
  value,
  onChange,
  onIntent,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
  onIntent?: (period: DashboardPeriod) => void;
}) {
  return (
    <TimeRangeSelector
      value={value}
      onChange={onChange}
      onOptionIntent={onIntent}
      options={PERIOD_OPTIONS}
      compact
      variant="segmented"
      ariaLabel="Chart range"
    />
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
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-label-13 text-gray-900">
            {COMMODITY_CARD_LABELS[commodity] ?? COMMODITY_LABELS[commodity] ?? commodity}
          </p>
          <InfoTooltip
            text={COMMODITY_HELP[commodity] ?? "Oil or gas price context. Source listed on the card."}
            label={`What is ${COMMODITY_CARD_LABELS[commodity] ?? commodity}?`}
          />
        </div>
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
      <Skeleton className="h-64 w-full" />
      <CardLoading />
    </div>
  );
}

function CommoditySkeleton() {
  return (
    <>
      <div className="grid sm:grid-cols-3">
        {COMMODITY_CARD_KEYS.map((commodity) => (
          <div
            key={commodity}
            className={
              commodity === COMMODITY_CARD_KEYS[0]
                ? "pb-4 sm:pr-6 sm:pb-0"
                : "border-t border-gray-alpha-400 py-4 sm:border-t-0 sm:border-l sm:px-6 sm:py-0"
            }
          >
            <Skeleton className="h-28 w-full" />
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-gray-alpha-400 pt-5">
        <CardLoading />
      </div>
    </>
  );
}

function BlockQueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <CardError>
      Couldn&apos;t load this chart.{" "}
      <button
        type="button"
        className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
        onClick={onRetry}
      >
        Retry
      </button>
    </CardError>
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
  return ` ${unit.replace(/^[$€£]\s*/, "").replace("BBL", "bbl").replace("MMBTU", "MMBtu")}`;
}
