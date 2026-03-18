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
import { Zap, Flame, Wind, BarChart3, RefreshCw } from "lucide-react";

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
        fetch(`/api/prices?range=${r === "24h" || r === "7d" ? "30d" : r === "30d" ? "30d" : "90d"}`),
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
  const latestWti = prices.find(
    (p) => p.commodity === "wti_crude" && p.date === (latestBrent?.date ?? "")
  ) ?? prices.filter((p) => p.commodity === "wti_crude").pop();
  const latestGas = prices.find(
    (p) => p.commodity === "henry_hub_gas" && p.date === (latestBrent?.date ?? "")
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Energy Grid Monitor</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                UK Grid + Global Commodity Prices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TimeRangeSelector value={range} onChange={setRange} />
            <button
              onClick={() => fetchData(range)}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Carbon Intensity"
            value={latest ? String(Math.round(latest.carbon_intensity)) : "—"}
            unit="gCO₂/kWh"
            detail={latest ? latest.carbon_index : undefined}
            color={latest ? carbonIndexColor(latest.carbon_index) : undefined}
          />
          <KpiCard
            label="Demand"
            value={latest ? `${(latest.demand_mw / 1000).toFixed(1)}` : "—"}
            unit="GW"
          />
          <KpiCard
            label="Elec. Price"
            value={latest ? `£${latest.price_gbp_mwh.toFixed(0)}` : "—"}
            unit="/MWh"
          />
          <KpiCard
            label="Brent Crude"
            value={latestBrent ? `$${latestBrent.price.toFixed(2)}` : "—"}
            unit="/bbl"
            detail={latestBrent?.date}
          />
          <KpiCard
            label="WTI Crude"
            value={latestWti ? `$${latestWti.price.toFixed(2)}` : "—"}
            unit="/bbl"
          />
          <KpiCard
            label="Henry Hub Gas"
            value={latestGas ? `$${latestGas.price.toFixed(2)}` : "—"}
            unit="/MMBtu"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Carbon Intensity */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wind className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-medium">Carbon Intensity</h2>
            </div>
            {snapshots.length > 0 ? (
              <CarbonIntensityChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </section>

          {/* Electricity Price */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-medium">System Price (£/MWh)</h2>
            </div>
            {snapshots.length > 0 ? (
              <ElectricityPriceChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </section>

          {/* Demand */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-medium">Demand</h2>
            </div>
            {snapshots.length > 0 ? (
              <DemandChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </section>

          {/* Generation Mix (pie) */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-medium">Generation Mix (Latest)</h2>
            </div>
            {latest ? (
              <GenerationMixChart data={genMixData} />
            ) : (
              <EmptyState />
            )}
          </section>

          {/* Generation Stack over time */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 lg:col-span-2">
            <h2 className="text-sm font-medium mb-3">Generation Mix Over Time</h2>
            {snapshots.length > 0 ? (
              <GenerationStackChart data={snapshots} />
            ) : (
              <EmptyState />
            )}
          </section>

          {/* Commodity Prices */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 lg:col-span-2">
            <h2 className="text-sm font-medium mb-3">Oil & Gas Prices (USD)</h2>
            {prices.length > 0 ? (
              <CommodityChart data={prices} />
            ) : (
              <EmptyState />
            )}
          </section>
        </div>

        {/* API docs teaser */}
        <footer className="border-t border-zinc-200 dark:border-zinc-800 pt-4 pb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
            <span>Public API available:</span>
            <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
              GET /api/snapshots?range=24h
            </code>
            <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
              GET /api/prices?range=30d
            </code>
            <span className="ml-auto">Rate limit: 60 req/min</span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
            Data: Carbon Intensity API, Elexon BMRS, US EIA. Updated hourly.
          </p>
        </footer>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-64 flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
      No data yet. The cron job collects data every hour.
    </div>
  );
}
