"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { CommodityPrice, CommodityRange, EnergySnapshot, Generation5min } from "@/lib/types";
import {
  CARBON_INTENSITY_API_URL,
  CARBON_INTENSITY_ATTRIBUTION,
  captionCarbon,
  captionCommodities,
  captionElexon,
  captionGeneration,
  captionNeso,
  captionTransfers,
  elexonBmrsAttribution,
  ELEXON_BMRS_LICENCE_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  NI_FLOW_NOTE,
} from "@/lib/attribution";
import Link from "next/link";
import { NI_PATH } from "@/lib/eirgrid/copy";
import { SiteLegalNav } from "@/components/site-legal-nav";
import { SitePublicNav } from "@/components/site-public-nav";
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
  dashboardQueryKey,
  effectiveBlockPeriod,
  pricesQueryKey,
} from "@/lib/dashboard-blocks";
import { fetchDashboardPayload, fetchPublicPrices } from "@/lib/dashboard-client";
import { prefetchQuery, revalidateAllQueries, seedQuery } from "@/lib/client-query";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
import { useClientQuery } from "@/lib/use-client-query";
import { JumpTo } from "@/components/jump-to";
import { RecordsCard } from "@/components/records-card";
import { EnergyTransition } from "@/components/energy-transition";
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
import { generationMixShares } from "@/lib/generation-share";
import { getLatestFacts } from "@/lib/facts";
import { HomepageBriefing } from "@/components/homepage-briefing";
import { HOME_H1, historicalHomepageH1, type HomepageCite } from "@/lib/homepage-briefing";
import { PeriodTabs } from "@/components/period-tabs";
import { shareFocusPath } from "@/lib/page-metadata";
import { getLondonDate } from "@/lib/london-time";
import { GenerationDesk, GenerationDeskSkeleton } from "@/components/generation-desk";
import { TodayMapCard } from "@/components/today-map-card";
import { SectionBlock } from "@/components/section-block";
import { SiteHeader } from "@/components/site-header";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { GbGasSapCard } from "@/components/gb-gas-sap-card";
import {
  CARD_PAD_RIGHT_FROM_LG,
  CARD_PAD_X_FROM_LG,
  Card,
  CardEmpty,
  CardError,
  CardLoading,
  PAGE_STACK_CLASS,
} from "@/components/ui/card";
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

export function Dashboard({
  initialPayload = null,
  cite,
}: {
  initialPayload?: DashboardPayload | null;
  cite: HomepageCite;
}) {
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

  const dayQueryDate = queryDateForPeriod("day", urlState.date, todayDate);
  if (initialPayload && dayQueryDate === null) {
    seedQuery(dashboardQueryKey("day", null), hydrateDashboardPayload(initialPayload));
  }

  const generation = useDashboardPeriod(
    generationPeriod,
    queryDateForPeriod(generationPeriod, urlState.date, todayDate),
    initialForPeriod(generationPeriod, urlState.date, todayDate, initialPayload)
  );
  const price = useDashboardPeriod(
    pricePeriod,
    queryDateForPeriod(pricePeriod, urlState.date, todayDate),
    initialForPeriod(pricePeriod, urlState.date, todayDate, initialPayload)
  );
  const transfers = useDashboardPeriod(
    transfersPeriod,
    queryDateForPeriod(transfersPeriod, urlState.date, todayDate),
    initialForPeriod(transfersPeriod, urlState.date, todayDate, initialPayload)
  );
  const mix = useDashboardPeriod(
    mixPeriod,
    queryDateForPeriod(mixPeriod, urlState.date, todayDate),
    initialForPeriod(mixPeriod, urlState.date, todayDate, initialPayload)
  );
  const carbon = useDashboardPeriod(
    carbonPeriod,
    queryDateForPeriod(carbonPeriod, urlState.date, todayDate),
    initialForPeriod(carbonPeriod, urlState.date, todayDate, initialPayload)
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

  const topShare = generationMixShares(facts.generationRows, power.generationStartUtc)[0] ?? null;

  const answer = buildAnswerSentence({
    topFuel: topShare?.fuel ?? null,
    topMw: topShare?.mw ?? null,
    topSharePct: topShare?.sharePct ?? null,
    topShareDisplayPct: topShare?.displayPct ?? null,
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

  const prefetchBlock = (next: DashboardPeriod) => {
    prefetchPeriod(next, queryDateForPeriod(next, urlState.date, todayDate));
  };

  return (
    <div className="bg-background-100 text-gray-1000">
      <a
        href="#section-overview"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-md focus:border focus:border-gray-alpha-400 focus:bg-background-100 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <SiteHeader
        activeDate={activeDate}
        minDate={getDashboardCoverageStart(now)}
        maxDate={todayDate}
        onDateChange={(date) => {
          void setUrlState({ date: date || todayDate });
        }}
        showDate={period === "day"}
        stamp={facts.headerStamp}
        stale={facts.isStale}
        copied={copied}
        onShare={async () => {
          await navigator.clipboard.writeText(
            `${window.location.origin}${shareFocusPath(focus)}`
          );
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      />

      <div className={`${PAGE_STACK_CLASS} pb-0 sm:pb-0`}>
        <HomepageBriefing
          cite={cite}
          title={dayQueryDate ? historicalHomepageH1(dayQueryDate) : HOME_H1}
          showCite={dayQueryDate === null}
          controls={
            <PeriodTabs
              period={period}
              pending={isPending}
              onPeriodIntent={prefetchBlock}
              onPeriodChange={(nextPeriod) => {
                void setUrlState({
                  ...searchStateForPeriod(nextPeriod),
                  generationPeriod: null,
                  pricePeriod: null,
                  transfersPeriod: null,
                  mixPeriod: null,
                  carbonPeriod: null,
                });
              }}
            />
          }
        />
        <JumpTo
          items={[
            { href: "#section-generation", label: "Latest half-hour" },
            { href: "#section-price", label: "Price" },
            { href: "#section-transfers", label: "Flows" },
            { href: "#section-commodities", label: "Oil and gas" },
            { href: "#section-records", label: "Records" },
            { href: "#section-carbon", label: "Carbon" },
          ]}
        />
      </div>

      <main className={PAGE_STACK_CLASS}>
        {generation.error && !generationData ? (
          <Card>
            <CardError>
              Couldn&apos;t load the grid.{" "}
              <button
                type="button"
                className="inline-flex min-h-6 items-center underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
                onClick={() => revalidateAllQueries()}
              >
                Retry
              </button>
            </CardError>
          </Card>
        ) : null}
        {facts.empty && facts.emptyState && generationData ? (
          <section id="section-overview" className="scroll-mt-28">
            <Card>
              <p className="text-copy-16 text-gray-900">{facts.emptyState.message}</p>
              <a
                href={facts.emptyState.href}
                className="mt-4 inline-flex h-8 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000"
              >
                {facts.emptyState.action}
              </a>
            </Card>
          </section>
        ) : (
          <section id="section-overview" className="scroll-mt-28">
            <Card id="section-generation" flush className="@container">
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
                    neso={neso}
                    question="Latest half-hour"
                    answer={answer}
                  />
                </>
              )}
            </Card>
          </section>
        )}

        <TodayMapCard />

        <SectionBlock
          id="section-price"
          title="What does electricity cost?"
          tooltip="Market is the short-term wholesale market price from Elexon’s Market Index (APXMIDP). It is not the day-ahead auction price. System is the imbalance (cash-out) price for being long or short in a half-hour."
          footer={captionElexon()}
          active={focus === "price"}
          headerRight={
            <div className="flex flex-wrap items-center gap-3">
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
          footer={captionTransfers(transfersNeso)}
          active={focus === "transfers"}
        >
          {transfers.error && !transfersData ? (
            <BlockQueryError onRetry={() => revalidateAllQueries()} />
          ) : transfers.isLoading ? (
            <TransfersSkeleton />
          ) : hasInterconnectorHistory ? (
            <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="min-w-0">
                <h3 className="mb-3 text-heading-16 text-gray-1000">Latest flows</h3>
                <InterconnectorChart data={latestTransferInterconnectors} />
              </div>
              <div className="min-w-0">
                <h3 className="mb-3 text-heading-16 text-gray-1000">Flows over time</h3>
                <InterconnectorFlowsChart data={transfersHistory} range={transfersChartRange} />
              </div>
            </div>
          ) : (
            <CardEmpty stamp={facts.headerStamp} />
          )}
          <p className="mt-4 break-words text-copy-14 text-gray-900">
            <Link href={NI_PATH} className="underline-offset-2 hover:underline">
              {NI_FLOW_NOTE}
            </Link>
          </p>
        </SectionBlock>

        <SectionBlock
          title="How has the mix changed?"
          tooltip="How the generation stack shifts through the selected window, including embedded solar and wind."
          footer={captionGeneration(isNesoPeriod(mixPeriod))}
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
          title="Gas and oil prices"
          tooltip="Oil and gas context on a slower market horizon. The chart keeps the full published set."
          footer={
            <>
              {captionCommodities()}{" "}
              <Link href="/prices/gas" className="text-blue-700 underline-offset-2 hover:underline">
                GB gas price
              </Link>
            </>
          }
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
              <div className="grid lg:grid-cols-3">
                {commodityCards.map(({ commodity, latest, absoluteDelta, percentageDelta }) => (
                  <div
                    key={commodity}
                    className={commodityColumnClass(commodity === commodityCards[0]?.commodity)}
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
          footer={
            <>
              {captionNeso()}{" "}
              <Link href="/records" className="text-blue-700 underline-offset-2 hover:underline">
                GB electricity records
              </Link>
            </>
          }
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
          footer={captionCarbon(isNesoPeriod(carbonPeriod))}
          active={focus === "carbon"}
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
            Grid is a public dashboard of Great Britain&apos;s electricity and gas. It refreshes every
            hour from Elexon, NESO, the Carbon Intensity API and solar (PV Live estimate). Oil and
            gas prices from EIA, the World Bank and National Gas refresh every 6 hours.{" "}
            <Link href="/methodology" className="inline-flex min-h-6 items-center text-blue-700 underline-offset-2 hover:underline">
              How the numbers are made
            </Link>
            . The{" "}
            <Link href="/api" className="inline-flex min-h-6 items-center text-blue-700 underline-offset-2 hover:underline">
              API page
            </Link>{" "}
            documents the public JSON.
          </p>
          <p className="mt-3 max-w-3xl text-copy-14 text-gray-900">
            {elexonBmrsAttribution()}{" "}
            <a
              href={ELEXON_BMRS_LICENCE_URL}
              className="inline-flex min-h-6 items-center underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              BMRS Data Licence
            </a>
            . {NESO_OPEN_DATA_ATTRIBUTION}.{" "}
            <a
              href={NESO_OPEN_DATA_LICENCE_URL}
              className="inline-flex min-h-6 items-center underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              NESO Open Data Licence
            </a>
            . {CARBON_INTENSITY_ATTRIBUTION}{" "}
            <a
              href={CARBON_INTENSITY_API_URL}
              className="inline-flex min-h-6 items-center underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              carbonintensity.org.uk
            </a>
            .
          </p>
          <SitePublicNav className="mt-4" />
          <SiteLegalNav className="mt-4" />
        </footer>
      </main>
    </div>
  );
}

function initialForPeriod(
  period: DashboardPeriod,
  date: string | null,
  today: string,
  initialPayload: DashboardPayload | null
): DashboardPayload | null {
  if (!initialPayload || period !== "day" || queryDateForPeriod(period, date, today) !== null) {
    return null;
  }
  return initialPayload;
}

function useDashboardPeriod(
  period: DashboardPeriod,
  date: string | null,
  initial: DashboardPayload | null
) {
  const fetcher = useCallback(() => fetchDashboardPayload(period, date), [period, date]);
  const query = useClientQuery(dashboardQueryKey(period, date), fetcher);
  const hydrated = initial ? hydrateDashboardPayload(initial) : undefined;
  return {
    ...query,
    data: query.data ?? hydrated,
    isLoading: query.data === undefined && hydrated === undefined && query.error === undefined,
  };
}

function prefetchPeriod(period: DashboardPeriod, date: string | null): void {
  void prefetchQuery(dashboardQueryKey(period, date), () => fetchDashboardPayload(period, date));
}

function fallbackFacts(now: Date) {
  return {
    ...getLatestFacts({
      resolution: resolveDashboardDate(null, now, "24h"),
      snapshots: [],
      generation: [],
      now,
    }),
    headerStamp: "Grid updates hourly from public data.",
  };
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
          <p className="text-label-13 text-gray-900" title={COMMODITY_HELP[commodity]}>
            {COMMODITY_CARD_LABELS[commodity] ?? COMMODITY_LABELS[commodity] ?? commodity}
          </p>
        </div>
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: COMMODITY_COLORS[commodity] ?? "#64748b" }}
          aria-hidden="true"
        />
      </div>
      <p data-figure className="mt-2 whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
        <span data-value>{latest ? formatCommodityPrice(latest) : "—"}</span>
        {latest ? (
          <span data-unit className="align-baseline unit-label font-medium text-gray-900">
            {commodityUnitSuffix(latest.unit)}
          </span>
        ) : null}
      </p>
      <p className={`mt-1 text-label-13 ${rising ? "text-green-700" : "text-red-700"}`}>
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

function commodityColumnClass(first: boolean): string {
  return first
    ? `pb-4 lg:pb-0 ${CARD_PAD_RIGHT_FROM_LG}`
    : `border-t border-gray-alpha-400 py-4 lg:border-t-0 lg:border-l lg:py-0 ${CARD_PAD_X_FROM_LG}`;
}

function CommoditySkeleton() {
  return (
    <>
      <div className="grid lg:grid-cols-3">
        {COMMODITY_CARD_KEYS.map((commodity) => (
          <div key={commodity} className={commodityColumnClass(commodity === COMMODITY_CARD_KEYS[0])}>
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
