import { DASHBOARD_FOCUSES } from "@/lib/dashboard-search-params";
import { buildAnswerSentence } from "@/lib/answer-sentence";
import { formatHeadlineGw, type LatestFacts, type SupplyShare } from "@/lib/facts";
import { FUEL_COLORS, fuelLabel, COMMODITY_CARD_LABELS } from "@/lib/colors";
import { normalizeFuelType } from "@/lib/dashboard-model";
import type { GridRecords } from "@/lib/historic-mix";
import type { CommodityPrice } from "@/lib/types";
import { GB_GAS_SAP_COMMODITY, formatSapPencePerTherm } from "@/lib/gb-gas-sap";
import { FOCUS_PAGE_COPY, isDashboardFocus } from "@/lib/page-metadata";
import type { OgCacheSnapshot } from "@/lib/og/peek";

export const OG_PAGE_IDS = ["records", "privacy", "terms", "data-sources"] as const;

export type OgPageId = (typeof OG_PAGE_IDS)[number];

export type OgFocus = (typeof DASHBOARD_FOCUSES)[number];

export type OgVariant =
  | { kind: "focus"; focus: OgFocus }
  | { kind: "page"; page: OgPageId };

export type OgMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type OgMixSlice = {
  fuel: string;
  label: string;
  sharePct: number;
  color: string;
};

export type OgCard = {
  eyebrow: string;
  title: string;
  kicker: string | null;
  metrics: OgMetric[];
  mix: OgMixSlice[];
  stamp: string | null;
  cached: boolean;
};

const LEGAL_CARDS: Record<Exclude<OgPageId, "records">, Omit<OgCard, "cached">> = {
  privacy: {
    eyebrow: "Grid",
    title: "Privacy",
    kicker: "No accounts. No non-essential cookies.",
    metrics: [
      { label: "Controller", value: "Comonad Ltd" },
      { label: "Contact", value: "alex@comonad.co.uk" },
    ],
    mix: [],
    stamp: "UK GDPR",
  },
  terms: {
    eyebrow: "Grid",
    title: "Terms",
    kicker: "Informational only. Not financial advice.",
    metrics: [
      { label: "Code", value: "MIT" },
      { label: "Warranty", value: "None" },
    ],
    mix: [],
    stamp: "England and Wales",
  },
  "data-sources": {
    eyebrow: "Grid",
    title: "Data sources",
    kicker: "Licence and attribution for every feed Grid republishes.",
    metrics: [
      { label: "Grid", value: "Elexon, NESO, Carbon Intensity" },
      { label: "Context", value: "EIA, World Bank, National Gas" },
    ],
    mix: [],
    stamp: "Attributions",
  },
};

export function parseOgFocus(value: string | null): OgFocus {
  return isDashboardFocus(value) ? value : "overview";
}

export function parseOgPage(value: string | null): OgPageId | null {
  if (!value) {
    return null;
  }
  for (const page of OG_PAGE_IDS) {
    if (page === value) {
      return page;
    }
  }
  return null;
}

export function parseOgVariant(input: {
  focus?: string | null;
  page?: string | null;
}): OgVariant {
  const page = parseOgPage(input.page ?? null);
  if (page) {
    return { kind: "page", page };
  }
  return { kind: "focus", focus: parseOgFocus(input.focus ?? null) };
}

export function buildOgCard(variant: OgVariant, snapshot: OgCacheSnapshot): OgCard {
  switch (variant.kind) {
    case "page":
      return pageCard(variant.page, snapshot);
    case "focus":
      return focusCard(variant.focus, snapshot);
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

function pageCard(page: OgPageId, snapshot: OgCacheSnapshot): OgCard {
  switch (page) {
    case "records":
      return recordsCard(snapshot.records, true);
    case "privacy":
    case "terms":
    case "data-sources":
      return { ...LEGAL_CARDS[page], cached: true };
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
}

function focusCard(focus: OgFocus, snapshot: OgCacheSnapshot): OgCard {
  switch (focus) {
    case "overview":
    case "generation":
      return overviewCard(snapshot.facts, focus);
    case "price":
      return priceCard(snapshot.facts);
    case "transfers":
      return transfersCard(snapshot.facts);
    case "commodities":
      return commoditiesCard(snapshot.prices);
    case "records":
      return recordsCard(snapshot.records, Boolean(snapshot.records));
    case "carbon":
      return carbonCard(snapshot.facts);
    default: {
      const exhaustive: never = focus;
      return exhaustive;
    }
  }
}

function overviewCard(facts: LatestFacts | null, focus: "overview" | "generation"): OgCard {
  const copy = FOCUS_PAGE_COPY[focus];
  if (!facts || facts.empty) {
    return branded(copy.title.replace(" — Grid", ""), copy.description, false);
  }

  const top = facts.shares[0] ?? null;
  const title = buildAnswerSentence({
    topFuel: top?.fuel ?? null,
    topMw: top?.mw ?? null,
    topSharePct: top?.sharePct ?? null,
    transfersMw: facts.netImportsMw.value,
    empty: facts.empty,
  });

  return {
    eyebrow: "Grid",
    title,
    kicker: focus === "generation" ? "What’s powering Britain" : "GB electricity",
    metrics: [
      {
        label: "Demand",
        value: `${formatHeadlineGw(facts.demand.value)} GW`,
        hint: "ITSDO + embedded",
      },
      {
        label: "Carbon",
        value: facts.carbon.value == null ? "—" : `${facts.carbon.value.toFixed(0)} g`,
        hint: "gCO₂/kWh",
      },
      {
        label: "Market",
        value: formatPrice(facts.price.value),
        hint: "£/MWh",
      },
    ],
    mix: mixSlices(facts.shares),
    stamp: facts.stamp,
    cached: true,
  };
}

function priceCard(facts: LatestFacts | null): OgCard {
  if (!facts || facts.price.value == null) {
    return branded("What does power cost?", "Short-term wholesale market price from Elexon.", false);
  }

  return {
    eyebrow: "Grid · Price",
    title: formatPrice(facts.price.value),
    kicker: "Market Index (APXMIDP)",
    metrics: [
      { label: "System", value: formatPrice(facts.systemPrice.value), hint: "Imbalance" },
      {
        label: "Demand",
        value: `${formatHeadlineGw(facts.demand.value)} GW`,
      },
    ],
    mix: [],
    stamp: facts.stamp,
    cached: true,
  };
}

function transfersCard(facts: LatestFacts | null): OgCard {
  if (!facts || facts.netImportsMw.value == null) {
    return branded("Where is power flowing?", "Metered interconnector flows from Elexon FUELINST.", false);
  }

  const mw = facts.netImportsMw.value;
  const importing = mw >= 0;
  return {
    eyebrow: "Grid · Transfers",
    title: `${importing ? "Importing" : "Exporting"} ${formatHeadlineGw(Math.abs(mw))} GW`,
    kicker: "Net interconnector flow",
    metrics: [
      { label: "Generation", value: `${formatHeadlineGw(facts.generationMw.value)} GW` },
      { label: "Demand", value: `${formatHeadlineGw(facts.demand.value)} GW` },
    ],
    mix: [],
    stamp: facts.stamp,
    cached: true,
  };
}

function commoditiesCard(prices: CommodityPrice[] | null): OgCard {
  const latest = latestByCommodity(prices ?? []);
  const brent = latest.get("brent_crude");
  const hub = latest.get("henry_hub_gas");
  const sap = latest.get(GB_GAS_SAP_COMMODITY);

  if (!brent && !hub && !sap) {
    return branded("Gas & oil", "EIA, World Bank Pink Sheet, and National Gas SAP.", false);
  }

  return {
    eyebrow: "Grid · Commodities",
    title: "Gas & oil",
    kicker: "Context for GB power prices",
    metrics: [
      {
        label: COMMODITY_CARD_LABELS.brent_crude ?? "Brent",
        value: brent ? `$${brent.price.toFixed(2)}` : "—",
      },
      {
        label: COMMODITY_CARD_LABELS.henry_hub_gas ?? "Henry Hub",
        value: hub ? `$${hub.price.toFixed(2)}` : "—",
      },
      {
        label: COMMODITY_CARD_LABELS.gb_gas_sap ?? "GB gas",
        value: sap ? formatSapPencePerTherm(sap.price) : "—",
      },
    ],
    mix: [],
    stamp: brent?.date ?? hub?.date ?? sap?.date ?? null,
    cached: true,
  };
}

function carbonCard(facts: LatestFacts | null): OgCard {
  if (!facts || facts.carbon.value == null) {
    return branded("How clean is it?", "National carbon intensity from the NESO Carbon Intensity API.", false);
  }

  return {
    eyebrow: "Grid · Carbon",
    title: `${facts.carbon.value.toFixed(0)} gCO₂/kWh`,
    kicker: facts.carbon.index ? `Index: ${facts.carbon.index}` : "National carbon intensity",
    metrics: [
      { label: "Demand", value: `${formatHeadlineGw(facts.demand.value)} GW` },
      {
        label: "Largest source",
        value: facts.shares[0] ? fuelLabel(normalizeFuelType(facts.shares[0].fuel)) : "—",
      },
    ],
    mix: mixSlices(facts.shares),
    stamp: facts.stamp,
    cached: true,
  };
}

function recordsCard(records: GridRecords | null, cached: boolean): OgCard {
  if (!records) {
    return branded(
      "Electricity records",
      "Highest wind and solar, lowest carbon, days since coal ended.",
      cached
    );
  }

  return {
    eyebrow: "Grid · Records",
    title: "Electricity records",
    kicker: "NESO historic generation mix",
    metrics: [
      {
        label: "Highest wind",
        value: `${formatHeadlineGw(records.maxWind?.value ?? null)} GW`,
      },
      {
        label: "Highest solar",
        value: `${formatHeadlineGw(records.maxSolar?.value ?? null)} GW`,
      },
      {
        label: "Lowest carbon",
        value: records.lowestCarbon ? `${records.lowestCarbon.value.toFixed(0)} g` : "—",
      },
      {
        label: "Days since coal ended",
        value: records.daysSinceCoal == null ? "—" : String(records.daysSinceCoal),
      },
    ],
    mix: [],
    stamp: null,
    cached,
  };
}

function branded(title: string, kicker: string, cached: boolean): OgCard {
  return {
    eyebrow: "Grid",
    title,
    kicker,
    metrics: [],
    mix: [],
    stamp: cached ? null : "Cached figures unavailable",
    cached,
  };
}

function mixSlices(shares: SupplyShare[]): OgMixSlice[] {
  return shares.slice(0, 6).map((share) => {
    const fuel = normalizeFuelType(share.fuel);
    return {
      fuel,
      label: fuelLabel(fuel),
      sharePct: share.sharePct,
      color: FUEL_COLORS[fuel] ?? FUEL_COLORS.other ?? "#9ca3af",
    };
  });
}

function formatPrice(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return `£${value.toFixed(0)}/MWh`;
}

function latestByCommodity(prices: CommodityPrice[]): Map<string, CommodityPrice> {
  const latest = new Map<string, CommodityPrice>();
  for (const row of prices) {
    const existing = latest.get(row.commodity);
    if (!existing || row.date > existing.date) {
      latest.set(row.commodity, row);
    }
  }
  return latest;
}

export function fixtureOgSnapshot(): OgCacheSnapshot {
  return {
    facts: {
      empty: false,
      emptyState: null,
      coverageStart: "2025-10-10",
      requestedDate: "2026-10-10",
      isHistorical: false,
      isStale: false,
      stamp: "10 Oct 2026, 12:00 BST",
      headerStamp: "Data as of 10 Oct 2026, 12:00 BST",
      carbon: {
        value: 86,
        index: "low",
        unit: "gCO₂/kWh",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:30:00.000Z",
        source: "Carbon Intensity API",
        definition: "National carbon intensity",
      },
      demand: {
        value: 32_400,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:30:00.000Z",
        source: "Elexon BMRS",
        definition: "ITSDO",
      },
      price: {
        value: 67,
        unit: "£/MWh",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:30:00.000Z",
        source: "Elexon BMRS",
        definition: "Market Index",
      },
      systemPrice: {
        value: 72,
        unit: "£/MWh",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:30:00.000Z",
        source: "Elexon BMRS",
        definition: "System price",
      },
      generationMw: {
        value: 30_100,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:30:00.000Z",
        source: "Elexon BMRS, NESO, Sheffield Solar PV Live",
        definition: "GB generation",
      },
      netImportsMw: {
        value: 2_300,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:30:00.000Z",
        source: "Elexon BMRS",
        definition: "Net imports",
      },
      pumpedStorageMw: {
        value: 200,
        unit: "MW",
        periodStartUtc: "2026-10-10T11:00:00.000Z",
        periodEndUtc: "2026-10-10T11:30:00.000Z",
        source: "Elexon BMRS",
        definition: "Pumped storage",
      },
      shares: [
        { fuel: "wind", mw: 12_000, sharePct: 37.0 },
        { fuel: "gas", mw: 8_400, sharePct: 25.9 },
        { fuel: "nuclear", mw: 5_200, sharePct: 16.0 },
        { fuel: "imports", mw: 2_300, sharePct: 7.1 },
        { fuel: "biomass", mw: 1_800, sharePct: 5.6 },
        { fuel: "solar", mw: 1_200, sharePct: 3.7 },
      ],
      generationRows: [],
      mixSnapshot: null,
      referenceTimestamp: "2026-10-10T11:00:00.000Z",
    },
    records: {
      maxWind: {
        value: 22_400,
        timestampUtc: "2025-12-18T03:00:00.000Z",
        basis: "Transmission-connected wind plus embedded wind.",
      },
      maxSolar: {
        value: 11_200,
        timestampUtc: "2025-06-14T12:00:00.000Z",
        basis: "NESO historic mix solar.",
      },
      lowestCarbon: {
        value: 18,
        timestampUtc: "2025-05-11T14:00:00.000Z",
        basis: "Half-hour carbon intensity.",
      },
      highestRenewableShare: null,
      highestZeroCarbonShare: null,
      lastCoal: {
        value: 0,
        timestampUtc: "2024-09-30T00:00:00.000Z",
        basis: "Ratcliffe-on-Soar closed.",
      },
      daysSinceCoal: 375,
      windMilestones: [],
    },
    prices: [
      { date: "2026-10-09", commodity: "brent_crude", price: 74.2, currency: "USD", unit: "$/BBL" },
      { date: "2026-10-09", commodity: "henry_hub_gas", price: 3.12, currency: "USD", unit: "$/MMBTU" },
      { date: "2026-10-09", commodity: GB_GAS_SAP_COMMODITY, price: 2.4, currency: "GBP", unit: "p/kWh" },
    ],
  };
}

export function sampleOgVariants(): OgVariant[] {
  return [
    ...DASHBOARD_FOCUSES.map((focus) => ({ kind: "focus" as const, focus })),
    ...OG_PAGE_IDS.map((page) => ({ kind: "page" as const, page })),
  ];
}

export function ogSampleFilename(variant: OgVariant): string {
  switch (variant.kind) {
    case "focus":
      return `focus-${variant.focus}.png`;
    case "page":
      return `page-${variant.page}.png`;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

