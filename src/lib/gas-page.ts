import { COMMODITY_CARD_LABELS, COMMODITY_LABELS } from "@/lib/colors";
import { filterPublicCommodityPrices } from "@/lib/commodity-series";
import {
  formatSapPencePerTherm,
  GB_GAS_SAP_COMMODITY,
  sapPencePerTherm,
} from "@/lib/gb-gas-sap";
import { formatLondonDayMonthYear } from "@/lib/london-time";
import type { CommodityPrice } from "@/lib/types";

export const GAS_PAGE_SOURCES =
  "Source: National Gas, published as the System Average Price (PUBOB603).";

export type GasBenchmark = {
  commodity: string;
  label: string;
  date: string;
  dateLabel: string;
  value: string;
  unit: string;
  source: string;
  monthly: boolean;
  spark: number[];
  change: string | null;
};

export type GasPageModel = {
  kind: "numbers" | "fallback";
  sap: CommodityPrice | null;
  sapPencePerKwh: string | null;
  sapPencePerTherm: string | null;
  gasDayLabel: string | null;
  publishedLabel: string | null;
  series: GasBenchmark[];
};

const BENCHMARKS = [
  {
    commodity: GB_GAS_SAP_COMMODITY,
    source: "National Gas",
  },
  {
    commodity: "henry_hub_gas",
    source: "U.S. EIA",
  },
  {
    commodity: "eu_natural_gas",
    source: "World Bank Pink Sheet",
  },
  {
    commodity: "lng_asia",
    source: "World Bank Pink Sheet",
  },
] as const;

export function displayCommodityUnit(commodity: string, unit: string): string {
  if (commodity === GB_GAS_SAP_COMMODITY) {
    return "p/therm";
  }
  return unit.replace("MMBTU", "MMBtu");
}

function recentValues(rows: CommodityPrice[], commodity: string): number[] {
  return rows
    .filter((row) => row.commodity === commodity)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => (commodity === GB_GAS_SAP_COMMODITY ? sapPencePerTherm(row.price) : row.price));
}

function formatChange(delta: number, commodity: string): string {
  const digits = commodity === GB_GAS_SAP_COMMODITY ? 1 : 2;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(digits)} vs prior`;
}

export function latestCommodity(
  rows: CommodityPrice[],
  commodity: string
): CommodityPrice | null {
  let latest: CommodityPrice | null = null;
  for (const row of rows) {
    if (row.commodity !== commodity) {
      continue;
    }
    if (!latest || row.date > latest.date) {
      latest = row;
    }
  }
  return latest;
}

export function meanCommodityInWindow(
  rows: CommodityPrice[],
  commodity: string,
  from: string,
  to: string
): { average: number; count: number; from: string; to: string } | null {
  const wanted = rows.filter(
    (row) => row.commodity === commodity && row.date >= from && row.date <= to
  );
  if (wanted.length === 0) {
    return null;
  }
  const total = wanted.reduce((sum, row) => sum + row.price, 0);
  const dates = wanted.map((row) => row.date).sort();
  return {
    average: total / wanted.length,
    count: wanted.length,
    from: dates[0] ?? from,
    to: dates[dates.length - 1] ?? to,
  };
}

export function buildGasPageModel(rows: CommodityPrice[]): GasPageModel {
  const publicRows = filterPublicCommodityPrices(rows);
  const sap = latestCommodity(publicRows, GB_GAS_SAP_COMMODITY);
  const series = BENCHMARKS.flatMap((benchmark) => {
    const row = latestCommodity(publicRows, benchmark.commodity);
    if (!row) {
      return [];
    }
    const monthly = row.commodity === "eu_natural_gas" || row.commodity === "lng_asia";
    const history = recentValues(publicRows, row.commodity);
    const latestValue = history[history.length - 1] ?? 0;
    const previous = history.length > 1 ? history[history.length - 2] : null;
    return [
      {
        commodity: row.commodity,
        label: COMMODITY_CARD_LABELS[row.commodity] ?? COMMODITY_LABELS[row.commodity] ?? row.commodity,
        date: row.date,
        dateLabel: formatLondonDayMonthYear(row.date),
        value:
          row.commodity === GB_GAS_SAP_COMMODITY ? latestValue.toFixed(1) : latestValue.toFixed(2),
        unit: displayCommodityUnit(row.commodity, row.unit),
        source: benchmark.source,
        monthly,
        spark: history.slice(-30),
        change: previous == null ? null : formatChange(latestValue - previous, row.commodity),
      } satisfies GasBenchmark,
    ];
  });

  return {
    kind: sap ? "numbers" : "fallback",
    sap,
    sapPencePerKwh: sap ? sap.price.toFixed(2) : null,
    sapPencePerTherm: sap ? sapPencePerTherm(sap.price).toFixed(1) : null,
    gasDayLabel: sap ? formatLondonDayMonthYear(sap.date) : null,
    publishedLabel: sap ? formatLondonDayMonthYear(sap.date) : null,
    series,
  };
}

export function gasCitePlainText(model: GasPageModel): string {
  if (model.kind === "fallback" || !model.sap || !model.sapPencePerKwh || !model.sapPencePerTherm) {
    return `GB System Average Price of gas from National Gas, with Henry Hub and World Bank monthly gas for context. ${GAS_PAGE_SOURCES}`;
  }
  return `The GB System Average Price of gas for ${model.gasDayLabel} was ${model.sapPencePerKwh}p/kWh (${model.sapPencePerTherm}p/therm). ${GAS_PAGE_SOURCES}`;
}

export function gasCitation(model: GasPageModel, accessedDate: string): string {
  return `Grid, "GB gas price today", grid.vahaah.com/prices/gas, accessed ${formatLondonDayMonthYear(accessedDate)}. Data: National Gas, EIA, World Bank.`;
}

export function gasFaqs(model: GasPageModel): Array<{ question: string; answer: string }> {
  const sapLine =
    model.sap && model.sapPencePerKwh && model.sapPencePerTherm
      ? ` The latest SAP Grid holds is ${model.sapPencePerKwh}p/kWh (${formatSapPencePerTherm(model.sap.price)}) for ${model.gasDayLabel}.`
      : "";
  return [
    {
      question: "What is the System Average Price?",
      answer: `SAP is National Gas's published System Average Price for the GB gas day (PUBOB603), in p/kWh.${sapLine} Source: National Gas.`,
    },
    {
      question: "What's the difference between SAP and NBP?",
      answer:
        "NBP is the GB wholesale gas hub used in traded contracts. SAP is the published system average for the gas day. Grid republishes SAP from National Gas and does not republish a separate NBP series.",
    },
    {
      question: "How do p/therm and p/kWh convert?",
      answer:
        "1 therm is 29.3071 kWh, so p/therm = p/kWh × 29.3071. Grid stores SAP in p/kWh and shows p/therm for traders.",
    },
    {
      question: "Why does gas set the electricity price?",
      answer:
        "Gas-fired stations are often the last plants needed to meet demand, so the wholesale electricity price frequently follows the cost of gas. See today's mix on /today. Grid does not claim a share of hours without a cited calculation.",
    },
  ];
}
