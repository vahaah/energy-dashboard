"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { COMMODITY_CARD_LABELS, COMMODITY_COLORS } from "@/lib/colors";
import { NATIONAL_GAS_ATTRIBUTION } from "@/lib/attribution";
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
  const thermDelta = sapPencePerTherm(absoluteDelta);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-label-13 text-gray-900">
            {COMMODITY_CARD_LABELS[GB_GAS_SAP_COMMODITY]}
          </p>
          <InfoTooltip
            text="Great Britain System Average Price for gas. Source: National Gas."
            label="What is GB gas (SAP)?"
          />
        </div>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: COMMODITY_COLORS[GB_GAS_SAP_COMMODITY] }}
          aria-hidden="true"
        />
      </div>
      <p data-figure className="mt-2 whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000">
        <span data-value>
          {latest ? formatSapPencePerTherm(latest.price).replace(" p/therm", "") : "—"}
        </span>
        <span data-unit className="align-baseline text-heading-32 text-gray-700">
          {" "}
          p/therm
        </span>
      </p>
      <p className="font-sans text-copy-14 tabular-nums text-gray-900">
        {latest ? formatSapGbpPerMwh(latest.price) : "No current value"}
      </p>
      <p className={`mt-1 text-label-12 ${rising ? "text-green-700" : "text-red-700"}`}>
        {rising ? (
          <ArrowUpRight className="mr-0.5 inline size-3.5" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="mr-0.5 inline size-3.5" aria-hidden="true" />
        )}
        {formatSignedThermDelta(thermDelta)} · {formatSignedPercentage(percentageDelta)}
      </p>
      <p className="mt-3 text-label-12 leading-5 text-gray-900">
        The average price of gas traded on National Gas&apos;s On-the-day Commodity Market for that
        gas day. {NATIONAL_GAS_ATTRIBUTION} Source:{" "}
        <a
          href={NATIONAL_GAS_DATA_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-1000 underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
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
