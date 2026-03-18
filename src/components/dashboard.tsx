"use client";

import { useState, useEffect, useCallback } from "react";
import type { EnergySnapshot, CommodityPrice, TimeRange } from "@/lib/types";
import { KpiCard } from "@/components/ui/kpi-card";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { CarbonIntensityChart } from "@/components/charts/carbon-intensity-chart";
import { ElectricityPriceChart } from "@/components/charts/price-chart";
import { DemandChart } from "@/components/charts/demand-chart";
import { GenerationMixChart } from "@/components/charts/generation-mix-chart";
import { GenerationStackChart } from "@/components/charts/generation-stack-chart";
import { CommodityChart } from "@/components/charts/commodity-chart";
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
} from "lucide-react";

interface Props {
  initialSnapshots: EnergySnapshot[];
  initialPrices: CommodityPrice[];
}

export function Dashboard({ initialSnapshots, initialPrices }: Props) {
  const [range, setRange] = useState<TimeRange>("24h");
  const [snapshots, setSnapshots] = useState<EnergySnapshot[]>(initialSnapshots);
  const [prices, setPrices] = useState<CommodityPrice[]>(initialPrices);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (r: TimeRange) => {
    setLoading(true);
    try {
      const [snapRes, priceRes] = await Promise.all([
        fetch(`/api/snapshots?range=${r}`),
        fetch(
          `/api/prices?range=${r === "24h" || r === "7d" ? "30d" : r === "30d" ? "30d" : "90d"}`
        ),
      ]);
      if (snapRes.ok) {
        const { data } = await snapRes.json();
        setSnapshots(data);
      }
      if (priceRes.ok) {
        const { data } = await priceRes.json();
        setPrices(data);
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
  const latestBrent = prices.find((p) => p.commodity === "brent_crude");
  const latestWti =
    prices.find(
      (p) => p.commodity === "wti_crude" && p.date === (latestBrent?.date ?? "")
    ) ?? prices.filter((p) => p.commodity === "wti_crude").pop();
  const latestGas =
    prices.find(
      (p) =>
        p.commodity === "henry_hub_gas" && p.date === (latestBrent?.date ?? "")
    ) ?? prices.filter((p) => p.commodity === "henry_hub_gas").pop();

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
            <span className="text-[11px] text-zinc-400 dark:text-zinc-600 tabular-nums hidden md:block">
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Carbon Intensity"
            value={latest ? String(Math.round(latest.carbon_intensity)) : "—"}
            unit="gCO₂/kWh"
            detail={latest ? latest.carbon_index : undefined}
            color={latest ? carbonIndexColor(latest.carbon_index) : undefined}
            icon={<Wind className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Demand"
            value={latest ? `${(latest.demand_mw / 1000).toFixed(1)}` : "—"}
            unit="GW"
            icon={<Activity className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Elec. Price"
            value={latest ? `£${latest.price_gbp_mwh.toFixed(0)}` : "—"}
            unit="/MWh"
            icon={<Zap className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Brent Crude"
            value={latestBrent ? `$${latestBrent.price.toFixed(2)}` : "—"}
            unit="/bbl"
            icon={<Droplets className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="WTI Crude"
            value={latestWti ? `$${latestWti.price.toFixed(2)}` : "—"}
            unit="/bbl"
            icon={<Droplets className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Henry Hub Gas"
            value={latestGas ? `$${latestGas.price.toFixed(2)}` : "—"}
            unit="/MMBtu"
            icon={<Flame className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Carbon Intensity */}
          <ChartCard
            title="Carbon Intensity"
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
            icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
          >
            {hasData ? <DemandChart data={snapshots} /> : <EmptyState />}
          </ChartCard>

          {/* Generation Mix (pie) */}
          <ChartCard
            title="Generation Mix (Latest)"
            icon={<Flame className="w-4 h-4 text-orange-500" />}
          >
            {latest ? (
              <GenerationMixChart data={genMixData} />
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Generation Stack over time */}
          <ChartCard
            title="Generation Mix Over Time"
            icon={<TrendingUp className="w-4 h-4 text-cyan-500" />}
            fullWidth
          >
            {hasData ? (
              <GenerationStackChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Commodity Prices */}
          <ChartCard
            title="Oil & Gas Prices (USD)"
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
              GET /api/prices?range=30d
            </code>
            <span className="sm:ml-auto">Rate limit: 60 req/min</span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-2">
            Data: Carbon Intensity API, Elexon BMRS, US EIA. Updated hourly.
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
  children,
  fullWidth,
}: {
  title: string;
  icon?: React.ReactNode;
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
