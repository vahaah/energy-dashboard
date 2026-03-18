"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  EnergySnapshot,
  CommodityPrice,
  Generation5min,
  TimeRange,
} from "@/lib/types";
import { KpiCard } from "@/components/ui/kpi-card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { CarbonIntensityChart } from "@/components/charts/carbon-intensity-chart";
import { ElectricityPriceChart } from "@/components/charts/price-chart";
import { DemandChart } from "@/components/charts/demand-chart";
import { GenerationMixChart } from "@/components/charts/generation-mix-chart";
import { GenerationStackChart } from "@/components/charts/generation-stack-chart";
import { CommodityChart } from "@/components/charts/commodity-chart";
import { GenerationTable } from "@/components/charts/generation-table";
import { InterconnectorChart } from "@/components/charts/interconnector-chart";
import { TransfersChart } from "@/components/charts/transfers-chart";
import { carbonIndexColor } from "@/lib/colors";
import {
  Zap,
  Flame,
  Wind,
  BarChart3,
  RefreshCw,
  Droplets,
  Activity,
  TrendingUp,
  Database,
  ArrowLeftRight,
  Gauge,
} from "lucide-react";

interface Props {
  initialSnapshots: EnergySnapshot[];
  initialPrices: CommodityPrice[];
  initialGeneration?: Generation5min[];
}

export function Dashboard({
  initialSnapshots,
  initialPrices,
  initialGeneration,
}: Props) {
  const [range, setRange] = useState<TimeRange>("24h");
  const [snapshots, setSnapshots] = useState<EnergySnapshot[]>(initialSnapshots);
  const [prices, setPrices] = useState<CommodityPrice[]>(initialPrices);
  const [generation, setGeneration] = useState<Generation5min[]>(
    initialGeneration ?? []
  );
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (r: TimeRange) => {
    setLoading(true);
    try {
      const priceRange =
        r === "1y" ? "1y" : r === "90d" ? "90d" : "90d";
      const [snapRes, priceRes, genRes] = await Promise.all([
        fetch(`/api/snapshots?range=${r}`),
        fetch(`/api/prices?range=${priceRange}`),
        fetch(`/api/generation?range=${r}`),
      ]);
      if (snapRes.ok) {
        const { data } = await snapRes.json();
        setSnapshots(data);
      }
      if (priceRes.ok) {
        const { data } = await priceRes.json();
        setPrices(data);
      }
      if (genRes.ok) {
        const { data } = await genRes.json();
        setGeneration(data);
      }
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (range !== "24h" || initialSnapshots.length === 0) {
      fetchData(range);
    }
  }, [range, fetchData, initialSnapshots.length]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchData(range), 300_000);
    return () => clearInterval(interval);
  }, [range, fetchData]);

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  // Single-pass lookup: last occurrence of each commodity (most recent)
  const latestPriceBy = useMemo(() => {
    const map = new Map<string, CommodityPrice>();
    for (const p of prices) map.set(p.commodity, p);
    return map;
  }, [prices]);
  const latestBrent = latestPriceBy.get("brent_crude");
  const latestWti = latestPriceBy.get("wti_crude");
  const latestGas = latestPriceBy.get("henry_hub_gas");
  const latestEuGas = latestPriceBy.get("eu_natural_gas");
  const latestLng = latestPriceBy.get("lng_asia");

  // Period averages for non-24h ranges
  const isAvgView = range !== "24h";
  const avgStats = useMemo(() => {
    if (!isAvgView || snapshots.length === 0) return null;
    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      carbon: Math.round(avg(snapshots.map((s) => s.carbon_intensity))),
      demand: avg(snapshots.map((s) => s.demand_mw)),
      price: avg(snapshots.map((s) => s.price_gbp_mwh)),
    };
  }, [isAvgView, snapshots]);

  // Derive generation totals and net transfers from 5-min data
  const genLatest = useMemo(() => {
    if (generation.length === 0) return [];
    // Get the latest timestamp
    const latestTs = generation.reduce(
      (max, g) => (g.timestamp > max ? g.timestamp : max),
      ""
    );
    return generation.filter((g) => g.timestamp === latestTs);
  }, [generation]);

  // Single-pass split: generation sources vs interconnectors
  const { genSources, genInterconnectors, totalGenMw, netTransfersMw } =
    useMemo(() => {
      const sources: Generation5min[] = [];
      const ics: Generation5min[] = [];
      let genSum = 0;
      let icSum = 0;
      for (const g of genLatest) {
        if (g.fuel_type.startsWith("INT")) {
          ics.push(g);
          icSum += g.generation_mw;
        } else {
          sources.push(g);
          genSum += g.generation_mw;
        }
      }
      return {
        genSources: sources,
        genInterconnectors: ics,
        totalGenMw: genSum,
        netTransfersMw: icSum,
      };
    }, [genLatest]);

  const genMixData: Record<string, number> = latest
    ? {
        gas: latest.gen_gas_pct,
        coal: latest.gen_coal_pct,
        nuclear: latest.gen_nuclear_pct,
        wind: latest.gen_wind_pct,
        solar: latest.gen_solar_pct,
        hydro: latest.gen_hydro_pct,
        biomass: latest.gen_biomass_pct,
        imports: latest.gen_imports_pct,
        other: latest.gen_other_pct,
      }
    : {};

  const hasData = snapshots.length > 0;
  const hasPrices = prices.length > 0;
  const hasGeneration = generation.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
            </div>
            <div className="leading-tight min-w-0">
              <h1 className="text-xs sm:text-sm font-semibold tracking-tight truncate">
                Energy Grid Monitor
              </h1>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-500 hidden sm:block">
                UK Grid + Global Commodity Prices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <TimeRangeSelector value={range} onChange={setRange} />
            <button
              onClick={() => fetchData(range)}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 text-zinc-500 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <span
              className="text-[11px] text-zinc-400 dark:text-zinc-600 tabular-nums hidden md:block"
              suppressHydrationWarning
            >
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* KPI Row 1 — Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Carbon Intensity"
            value={
              isAvgView && avgStats
                ? String(avgStats.carbon)
                : latest
                  ? String(Math.round(latest.carbon_intensity))
                  : "—"
            }
            unit="gCO₂/kWh"
            detail={
              isAvgView
                ? `${range} average`
                : latest
                  ? latest.carbon_index
                  : undefined
            }
            color={
              !isAvgView && latest
                ? carbonIndexColor(latest.carbon_index)
                : undefined
            }
            icon={<Wind className="w-3.5 h-3.5" />}
            tooltip="Grams of CO₂ emitted per kWh of electricity generated. Lower is cleaner."
          />
          <KpiCard
            label="Demand"
            value={
              isAvgView && avgStats
                ? `${(avgStats.demand / 1000).toFixed(1)}`
                : latest
                  ? `${(latest.demand_mw / 1000).toFixed(1)}`
                  : "—"
            }
            unit="GW"
            detail={isAvgView ? `${range} average` : undefined}
            icon={<Activity className="w-3.5 h-3.5" />}
            tooltip="Total electricity demand on the transmission system in gigawatts."
          />
          <KpiCard
            label="Generation"
            value={
              totalGenMw > 0 ? `${(totalGenMw / 1000).toFixed(1)}` : "—"
            }
            unit="GW"
            icon={<Gauge className="w-3.5 h-3.5" />}
            tooltip="Total electricity generation across all fuel types including embedded solar and wind."
          />
          <KpiCard
            label="Transfers"
            value={
              genInterconnectors.length > 0
                ? `${netTransfersMw >= 0 ? "+" : ""}${(netTransfersMw / 1000).toFixed(2)}`
                : "—"
            }
            unit="GW"
            detail={netTransfersMw >= 0 ? "net import" : "net export"}
            color={netTransfersMw >= 0 ? "#22c55e" : "#ef4444"}
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            tooltip="Net electricity imported (+) or exported (-) via undersea interconnectors to Europe and Ireland."
          />
          <KpiCard
            label="Elec. Price"
            value={
              isAvgView && avgStats
                ? `£${avgStats.price.toFixed(0)}`
                : latest
                  ? `£${latest.price_gbp_mwh.toFixed(0)}`
                  : "—"
            }
            unit="/MWh"
            detail={isAvgView ? `${range} average` : undefined}
            icon={<Zap className="w-3.5 h-3.5" />}
            tooltip="Elexon system buy price in £ per megawatt-hour. The wholesale cost of electricity."
          />
        </div>

        {/* KPI Row 2 — Commodities */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Brent Crude"
            value={latestBrent ? `$${latestBrent.price.toFixed(2)}` : "—"}
            unit="/bbl"
            icon={<Droplets className="w-3.5 h-3.5" />}
            tooltip="International oil benchmark, priced in USD per barrel. Used as reference for ~2/3 of global oil trades."
          />
          <KpiCard
            label="WTI Crude"
            value={latestWti ? `$${latestWti.price.toFixed(2)}` : "—"}
            unit="/bbl"
            icon={<Droplets className="w-3.5 h-3.5" />}
            tooltip="West Texas Intermediate — US oil benchmark, priced in USD per barrel."
          />
          <KpiCard
            label="Henry Hub Gas"
            value={latestGas ? `$${latestGas.price.toFixed(2)}` : "—"}
            unit="/MMBtu"
            icon={<Flame className="w-3.5 h-3.5" />}
            tooltip="US natural gas benchmark, priced in USD per million British thermal units."
          />
          <KpiCard
            label="EU Gas (TTF)"
            value={latestEuGas ? `$${latestEuGas.price.toFixed(2)}` : "—"}
            unit="/MMBtu"
            icon={<Flame className="w-3.5 h-3.5" />}
            tooltip="Dutch TTF — European natural gas benchmark. Key indicator for UK gas prices."
          />
          <KpiCard
            label="LNG Asia (JKM)"
            value={latestLng ? `$${latestLng.price.toFixed(2)}` : "—"}
            unit="/MMBtu"
            icon={<Flame className="w-3.5 h-3.5" />}
            tooltip="Japan Korea Marker — Asian LNG benchmark. Affects global LNG shipping and UK spot prices."
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Carbon Intensity */}
          <ChartCard
            title="Carbon Intensity"
            tooltip="Tracks grams of CO₂ per kWh over time. Drops when wind/solar generation increases."
            icon={<Wind className="w-4 h-4 text-emerald-500" />}
          >
            {hasData ? (
              <CarbonIntensityChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Electricity Price */}
          <ChartCard
            title="System Price (£/MWh)"
            tooltip="Wholesale electricity price from Elexon. Prices spike during high demand or low wind."
            icon={<Zap className="w-4 h-4 text-amber-500" />}
          >
            {hasData ? (
              <ElectricityPriceChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Demand */}
          <ChartCard
            title="Demand (MW)"
            tooltip="Total system demand. Peaks in winter evenings, dips overnight and in summer."
            icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
          >
            {hasData ? <DemandChart data={snapshots} /> : <EmptyState />}
          </ChartCard>

          {/* Generation Mix (pie) */}
          <ChartCard
            title="Generation Mix (Latest)"
            tooltip="Current share of each fuel type in the generation mix."
            icon={<Flame className="w-4 h-4 text-orange-500" />}
          >
            {latest ? (
              <GenerationMixChart data={genMixData} />
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Generation Table + Interconnectors — full width */}
          <ChartCard
            title="Generation Breakdown"
            tooltip="Detailed per-source generation in GW and % of demand, including embedded solar and wind from distribution networks."
            icon={<Gauge className="w-4 h-4 text-violet-500" />}
            fullWidth
          >
            {genSources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                    By Source
                  </h3>
                  <GenerationTable
                    data={genSources}
                    demandMw={latest?.demand_mw}
                  />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                    Interconnectors
                  </h3>
                  <InterconnectorChart data={genInterconnectors} />
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Generation Stack over time */}
          <ChartCard
            title="Generation Mix Over Time"
            tooltip="How the fuel mix changes throughout the day. Wind/solar follow weather patterns; gas fills the gaps."
            icon={<TrendingUp className="w-4 h-4 text-cyan-500" />}
            fullWidth
          >
            {hasData ? (
              <GenerationStackChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Transfers Over Time */}
          <ChartCard
            title="Net Transfers Over Time"
            tooltip="Net electricity flow via interconnectors. Positive = GB importing, negative = GB exporting."
            icon={<ArrowLeftRight className="w-4 h-4 text-emerald-500" />}
            fullWidth
          >
            {hasGeneration ? (
              <TransfersChart data={generation} />
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Commodity Prices */}
          <ChartCard
            title="Energy Commodity Prices (USD)"
            tooltip="Oil and gas benchmark prices that influence UK electricity costs."
            icon={<Droplets className="w-4 h-4 text-orange-400" />}
            fullWidth
          >
            {hasPrices ? <CommodityChart data={prices} /> : <EmptyState />}
          </ChartCard>
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-200 dark:border-zinc-800/60 pt-4 pb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-[11px] text-zinc-400 dark:text-zinc-600">
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              <span>Public API</span>
            </div>
            <code className="bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
              GET /api/snapshots?range=24h
            </code>
            <code className="bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
              GET /api/generation?range=24h
            </code>
            <code className="bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
              GET /api/prices?range=30d
            </code>
            <span className="sm:ml-auto">Rate limit: 60 req/min</span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-2">
            Contains BMRS data &copy; Elexon Limited. NESO Data Portal. Carbon
            Intensity API. US EIA. FRED. OilPriceAPI. Updated hourly.
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ─── Reusable chart card ─── */
function ChartCard({
  title,
  icon,
  tooltip,
  children,
  fullWidth,
}: {
  title: string;
  icon?: React.ReactNode;
  tooltip?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-4 sm:p-5 ${
        fullWidth ? "lg:col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {title}
        </h2>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      {children}
    </section>
  );
}

/* ─── Empty state ─── */
function EmptyState() {
  return (
    <div className="h-56 flex flex-col items-center justify-center gap-2">
      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
      </div>
      <p className="text-sm text-zinc-400 dark:text-zinc-600">No data yet</p>
      <p className="text-[11px] text-zinc-300 dark:text-zinc-700">
        The cron job collects data every hour
      </p>
    </div>
  );
}
