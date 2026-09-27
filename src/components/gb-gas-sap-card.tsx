"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { COMMODITY_CARD_LABELS, COMMODITY_COLORS } from "@/lib/colors";
import {
  formatSapGbpPerMwh,
  formatSapPencePerTherm,
  GB_GAS_SAP_COMMODITY,
  NATIONAL_GAS_DATA_PORTAL_URL,
  NATIONAL_GAS_SOURCE_LABEL,
  sapPencePerTherm,
} from "@/lib/gb-gas-sap";
import { formatLondonDateLabel, londonMidnightUtc } from "@/lib/london-time";
import type { CommodityPrice } from "@/lib/types";

export function GbGasSapCard({
  latest,
  absoluteDelta,
  percentageDelta,
}: {
  latest: CommodityPrice | undefined;
  absoluteDelta: number;
  percentageDelta: number;
}) {
  const rising = absoluteDelta >= 0;
  const deltaColor = rising ? "text-emerald-300" : "text-rose-300";
  const thermDelta = sapPencePerTherm(absoluteDelta);

  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          {COMMODITY_CARD_LABELS[GB_GAS_SAP_COMMODITY]}
        </p>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: COMMODITY_COLORS[GB_GAS_SAP_COMMODITY] }}
        />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white tabular-nums">
        {latest ? formatSapPencePerTherm(latest.price) : "—"}
      </p>
      <p className="mt-1 text-sm text-zinc-300 tabular-nums">
        {latest ? formatSapGbpPerMwh(latest.price) : "No current value"}
      </p>
      <div className={`mt-2 flex items-center gap-1 text-sm ${deltaColor}`}>
        {rising ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span className="tabular-nums">
          {formatSignedThermDelta(thermDelta)} · {formatSignedPercentage(percentageDelta)}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-400">
        The average price of gas traded on National Gas&apos;s On-the-day Commodity Market for that
        gas day.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Source:{" "}
        <a
          href={NATIONAL_GAS_DATA_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-white"
        >
          {NATIONAL_GAS_SOURCE_LABEL}
        </a>
        {latest ? ` · gas day ${formatLondonDateLabel(londonMidnightUtc(latest.date))}` : ""}
      </p>
    </div>
  );
}

function formatSignedThermDelta(value: number): string {
  const prefix = value >= 0 ? "+" : "−";
  return `${prefix}${Math.abs(value).toFixed(1)} p/therm`;
}

function formatSignedPercentage(value: number): string {
  const prefix = value >= 0 ? "+" : "−";
  return `${prefix}${Math.abs(value).toFixed(1)}%`;
}
