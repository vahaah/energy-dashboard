import { DASHBOARD_FOCUSES } from "@/lib/dashboard-search-params";
import { buildAnswerSentence } from "@/lib/answer-sentence";
import { formatHeadlineGw, type LatestFacts, type SupplyShare } from "@/lib/facts";
import { FUEL_COLORS, fuelLabel, COMMODITY_CARD_LABELS } from "@/lib/colors";
import {
  isInterconnectorFuel,
  mapGenerationFuelToStackKey,
  normalizeFuelType,
} from "@/lib/dashboard-model";
import type { GridRecords } from "@/lib/historic-mix";
import type { CommodityPrice } from "@/lib/types";
import { GB_GAS_SAP_COMMODITY, formatSapPencePerTherm } from "@/lib/gb-gas-sap";
import { formatLondonCiteDate, parseUtcDateTime } from "@/lib/london-time";
import { FOCUS_PAGE_COPY, isDashboardFocus } from "@/lib/page-metadata";
import type { OgCacheSnapshot } from "@/lib/og/peek";
import { OG_CACHE_CONTROL, OG_HOURLY_CACHE_CONTROL, SITE_ORIGIN } from "@/lib/site";

export const OG_PAGE_IDS = [
  "records",
  "privacy",
  "terms",
  "data-sources",
  "today",
  "price-cap",
  "methodology",
  "api",
  "gas",
] as const;

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
  source: string | null;
  cached: boolean;
};

export const OG_EYEBROW_SEPARATOR = " · ";
export const OG_FOOTER = new URL(SITE_ORIGIN).host;
export const OG_GRID_SOURCES = "Elexon, NESO, Carbon Intensity, Sheffield Solar PV Live";
export const OG_CONTEXT_SOURCES = "EIA, World Bank, National Gas";
export const OG_TODAY_SOURCES = OG_GRID_SOURCES;
export const OG_PRICE_SOURCE = "Elexon BMRS";
export const OG_CARBON_SOURCE = "NESO Carbon Intensity API";
export const OG_COMMODITY_SOURCE = "EIA, World Bank Pink Sheet, National Gas";

export function gridEyebrow(section?: string): string {
  return section ? `Grid${OG_EYEBROW_SEPARATOR}${section}` : "Grid";
}

const LEGAL_CARDS: Record<Exclude<OgPageId, "records">, Omit<OgCard, "cached">> = {
  today: {
    eyebrow: gridEyebrow("Today"),
    title: "Britain's electricity today",
    kicker: "Mix, carbon intensity and market price, updated hourly.",
    metrics: [{ label: "Cadence", value: "Hourly" }],
    mix: [],
    stamp: null,
    source: OG_TODAY_SOURCES,
  },
  "price-cap": {
    eyebrow: gridEyebrow("Price cap"),
    title: "Will energy bills go up in January 2027?",
    kicker: "Ofgem announces the next cap on 25 November 2026.",
    metrics: [
      { label: "Current cap", value: "£1,723" },
      { label: "Next announcement", value: "25 Nov 2026" },
    ],
    mix: [],
    stamp: null,
    source: "Ofgem",
  },
  methodology: {
    eyebrow: gridEyebrow("Methodology"),
    title: "How Grid's numbers are made",
    kicker: "Sources, licences, definitions and data checks.",
    metrics: [],
    mix: [],
    stamp: null,
    source: `${OG_GRID_SOURCES}. ${OG_CONTEXT_SOURCES}`,
  },
  api: {
    eyebrow: gridEyebrow("API"),
    title: "Free GB electricity data API",
    kicker: "JSON, no key, 60 requests a minute.",
    metrics: [
      { label: "Licence", value: "CC BY 4.0" },
      { label: "Rate limit", value: "60 / min" },
    ],
    mix: [],
    stamp: null,
    source: null,
  },
  gas: {
    eyebrow: gridEyebrow("Gas"),
    title: "UK gas price today",
    kicker: "GB System Average Price, Henry Hub and World Bank gas.",
    metrics: [{ label: "Cadence", value: "As published" }],
    mix: [],
    stamp: null,
    source: OG_COMMODITY_SOURCE,
  },
  privacy: {
    eyebrow: gridEyebrow("Privacy"),
    title: "Privacy",
    kicker: "No accounts. No non-essential cookies.",
    metrics: [
      { label: "Controller", value: "Comonad Ltd" },
      { label: "Contact", value: "alex@comonad.co.uk" },
    ],
    mix: [],
    stamp: null,
    source: "UK GDPR",
  },
  terms: {
    eyebrow: gridEyebrow("Terms"),
    title: "Terms",
    kicker: "Informational only. Not financial advice.",
    metrics: [
      { label: "Code", value: "MIT" },
      { label: "Warranty", value: "None" },
    ],
    mix: [],
    stamp: null,
    source: "England and Wales",
  },
  "data-sources": {
    eyebrow: gridEyebrow("Data sources"),
    title: "Data sources",
    kicker: "Licence and attribution for every feed Grid republishes.",
    metrics: [],
    mix: [],
    stamp: null,
    source: `${OG_GRID_SOURCES}. ${OG_CONTEXT_SOURCES}`,
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
      return finishCard(pageCard(variant.page, snapshot));
    case "focus":
      return finishCard(focusCard(variant.focus, snapshot));
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
    case "today":
      return todayCard(snapshot);
    case "gas":
      return gasCard(snapshot);
    case "privacy":
    case "terms":
    case "data-sources":
    case "price-cap":
    case "methodology":
    case "api":
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

  const shares = normalizeOgShares(facts.shares);
  const top = shares[0] ?? null;
  const title = buildAnswerSentence({
    topFuel: top?.fuel ?? null,
    topMw: top?.mw ?? null,
    topSharePct: top?.sharePct ?? null,
    transfersMw: facts.netImportsMw.value,
    empty: facts.empty,
  });

  return {
    eyebrow: focus === "generation" ? gridEyebrow("Generation") : "Grid",
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
      },
    ],
    mix: mixSlices(shares),
    stamp: facts.stamp,
    source: OG_GRID_SOURCES,
    cached: true,
  };
}

function priceCard(facts: LatestFacts | null): OgCard {
  if (!facts || facts.price.value == null) {
    return branded("What does power cost?", "Short-term wholesale market price from Elexon.", false);
  }

  return {
    eyebrow: gridEyebrow("Price"),
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
    source: OG_PRICE_SOURCE,
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
    eyebrow: gridEyebrow("Transfers"),
    title: `${importing ? "Importing" : "Exporting"} ${formatHeadlineGw(Math.abs(mw))} GW`,
    kicker: "Net interconnector flow",
    metrics: [
      { label: "Generation", value: `${formatHeadlineGw(facts.generationMw.value)} GW` },
      { label: "Demand", value: `${formatHeadlineGw(facts.demand.value)} GW` },
    ],
    mix: [],
    stamp: facts.stamp,
    source: OG_PRICE_SOURCE,
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
    eyebrow: gridEyebrow("Commodities"),
    title: "Gas & oil",
    kicker: "Context for GB power prices",
    metrics: [
      {
        label: COMMODITY_CARD_LABELS.brent_crude ?? "Brent",
        value: brent ? formatCommodityOgValue(brent) : "—",
      },
      {
        label: COMMODITY_CARD_LABELS.henry_hub_gas ?? "Henry Hub",
        value: hub ? formatCommodityOgValue(hub) : "—",
      },
      {
        label: COMMODITY_CARD_LABELS.gb_gas_sap ?? "GB gas",
        value: sap ? formatCommodityOgValue(sap) : "—",
      },
    ],
    mix: [],
    stamp: formatOgDayStamp(brent?.date ?? hub?.date ?? sap?.date ?? null),
    source: OG_COMMODITY_SOURCE,
    cached: true,
  };
}

function carbonCard(facts: LatestFacts | null): OgCard {
  if (!facts || facts.carbon.value == null) {
    return branded("How clean is it?", "National carbon intensity from the NESO Carbon Intensity API.", false);
  }

  const shares = normalizeOgShares(facts.shares);
  const top = shares[0] ?? null;

  return {
    eyebrow: gridEyebrow("Carbon"),
    title: `${facts.carbon.value.toFixed(0)} gCO₂/kWh`,
    kicker: facts.carbon.index ? `Index: ${facts.carbon.index}` : "National carbon intensity",
    metrics: [
      { label: "Demand", value: `${formatHeadlineGw(facts.demand.value)} GW` },
      {
        label: "Largest source",
        value: top ? fuelLabel(top.fuel) : "—",
      },
    ],
    mix: mixSlices(shares),
    stamp: facts.stamp,
    source: OG_CARBON_SOURCE,
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
    eyebrow: gridEyebrow("Records"),
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
        value: records.lowestCarbon ? `${records.lowestCarbon.value.toFixed(0)} gCO₂/kWh` : "—",
      },
      {
        label: "Days since coal ended",
        value: records.daysSinceCoal == null ? "—" : String(records.daysSinceCoal),
      },
    ],
    mix: [],
    stamp: null,
    source: null,
    cached,
  };
}

function todayCard(snapshot: OgCacheSnapshot): OgCard {
  const facts = snapshot.facts;
  if (!facts || facts.empty) {
    return { ...LEGAL_CARDS.today, cached: true };
  }

  const shares = normalizeOgShares(facts.shares);
  return {
    eyebrow: gridEyebrow("Today"),
    title: "Britain's electricity today",
    kicker: "Mix, carbon intensity and market price, updated hourly.",
    metrics: [
      {
        label: "Demand",
        value: `${formatHeadlineGw(facts.demand.value)} GW`,
      },
      {
        label: "Carbon",
        value: facts.carbon.value == null ? "—" : `${facts.carbon.value.toFixed(0)} g`,
        hint: "gCO₂/kWh",
      },
      {
        label: "Market",
        value: formatPrice(facts.price.value),
      },
    ],
    mix: mixSlices(shares),
    stamp: facts.stamp,
    source: OG_TODAY_SOURCES,
    cached: true,
  };
}

function gasCard(snapshot: OgCacheSnapshot): OgCard {
  const latest = latestByCommodity(snapshot.prices ?? []);
  const sap = latest.get(GB_GAS_SAP_COMMODITY);
  const hub = latest.get("henry_hub_gas");
  if (!sap && !hub) {
    return { ...LEGAL_CARDS.gas, cached: true };
  }

  return {
    eyebrow: gridEyebrow("Gas"),
    title: "UK gas price today",
    kicker: "GB System Average Price, Henry Hub and World Bank gas.",
    metrics: [
      {
        label: COMMODITY_CARD_LABELS.gb_gas_sap ?? "GB gas",
        value: sap ? formatCommodityOgValue(sap) : "—",
        hint: formatOgDayStamp(sap?.date) ?? undefined,
      },
      {
        label: COMMODITY_CARD_LABELS.henry_hub_gas ?? "Henry Hub",
        value: hub ? formatCommodityOgValue(hub) : "—",
        hint: formatOgDayStamp(hub?.date) ?? undefined,
      },
    ],
    mix: [],
    stamp: null,
    source: OG_COMMODITY_SOURCE,
    cached: true,
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
    source: null,
    cached,
  };
}

export function ogFuelKey(fuel: string): string {
  const normalized = normalizeFuelType(fuel);
  if (isInterconnectorFuel(normalized) || normalized === "imports") {
    return "imports";
  }

  switch (normalized) {
    case "embedded_wind":
    case "wind":
      return "wind";
    case "embedded_solar":
    case "solar":
      return "solar";
    default:
      return mapGenerationFuelToStackKey(normalized);
  }
}

export function normalizeOgShares(shares: SupplyShare[]): SupplyShare[] {
  const grouped = new Map<string, { mw: number; sharePct: number }>();
  for (const share of shares) {
    const fuel = ogFuelKey(share.fuel);
    const existing = grouped.get(fuel);
    grouped.set(fuel, {
      mw: (existing?.mw ?? 0) + share.mw,
      sharePct: (existing?.sharePct ?? 0) + share.sharePct,
    });
  }

  const positive = [...grouped.entries()].filter(([, row]) => row.mw > 0 || (row.mw === 0 && row.sharePct > 0));
  const totalMw = positive.reduce((sum, [, row]) => sum + row.mw, 0);
  const totalPct = positive.reduce((sum, [, row]) => sum + row.sharePct, 0);
  const combined: SupplyShare[] = positive.map(([fuel, row]) => ({
    fuel,
    mw: row.mw,
    sharePct: totalMw > 0 ? (row.mw / totalMw) * 100 : totalPct > 0 ? (row.sharePct / totalPct) * 100 : 0,
  }));

  combined.sort((left, right) => right.mw - left.mw || right.sharePct - left.sharePct);
  return combined;
}

export function ogCacheControl(variant: OgVariant): string {
  switch (variant.kind) {
    case "page":
      return pageCacheControl(variant.page);
    case "focus":
      return OG_CACHE_CONTROL;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

function pageCacheControl(page: OgPageId): string {
  switch (page) {
    case "today":
    case "gas":
      return OG_HOURLY_CACHE_CONTROL;
    case "records":
    case "privacy":
    case "terms":
    case "data-sources":
    case "price-cap":
    case "methodology":
    case "api":
      return OG_CACHE_CONTROL;
    default: {
      const exhaustive: never = page;
      return exhaustive;
    }
  }
}

function mixSlices(shares: SupplyShare[]): OgMixSlice[] {
  return shares.map((share) => {
    const fuel = share.fuel;
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

function formatCommodityOgValue(row: CommodityPrice): string {
  switch (row.commodity) {
    case "brent_crude":
    case "wti_crude":
      return `$${row.price.toFixed(2)}/bbl`;
    case "henry_hub_gas":
      return `$${row.price.toFixed(2)}/MMBtu`;
    case GB_GAS_SAP_COMMODITY:
      return formatSapPencePerTherm(row.price);
    default:
      return `$${row.price.toFixed(2)}`;
  }
}

export function formatOgDayStamp(isoDate: string | null | undefined): string | null {
  if (!isoDate) {
    return null;
  }
  const day = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return cleanText(isoDate);
  }
  return formatLondonCiteDate(parseUtcDateTime(`${day}T12:00:00.000Z`));
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function finishCard(card: OgCard): OgCard {
  return {
    ...card,
    eyebrow: cleanText(card.eyebrow),
    title: cleanText(card.title),
    kicker: card.kicker ? cleanText(card.kicker) : null,
    stamp: card.stamp ? cleanText(card.stamp) : null,
    source: card.source ? cleanText(card.source) : null,
    metrics: card.metrics.map((metric) => ({
      ...metric,
      label: cleanText(metric.label),
      value: cleanText(metric.value),
      hint: metric.hint ? cleanText(metric.hint) : undefined,
    })),
  };
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

export function realisticOgSnapshot(): OgCacheSnapshot {
  const snapshot = fixtureOgSnapshot();
  if (!snapshot.facts) {
    return snapshot;
  }

  return {
    ...snapshot,
    facts: {
      ...snapshot.facts,
      demand: { ...snapshot.facts.demand, value: 33_100 },
      carbon: { ...snapshot.facts.carbon, value: 93 },
      price: { ...snapshot.facts.price, value: 127 },
      netImportsMw: { ...snapshot.facts.netImportsMw, value: 6_100 },
      stamp: "Mon 12 Oct 2026, 12:55 BST",
      shares: [
        { fuel: "biomass", mw: 2_650, sharePct: 8.0 },
        { fuel: "ccgt", mw: 5_300, sharePct: 16.0 },
        { fuel: "hydro", mw: 330, sharePct: 1.0 },
        { fuel: "nuclear", mw: 3_310, sharePct: 10.0 },
        { fuel: "other", mw: 330, sharePct: 1.0 },
        { fuel: "ps", mw: 400, sharePct: 1.2 },
        { fuel: "WIND", mw: 9_000, sharePct: 27.2 },
        { fuel: "embedded_wind", mw: 4_000, sharePct: 12.1 },
        { fuel: "solar", mw: 500, sharePct: 1.5 },
        { fuel: "embedded_solar", mw: 800, sharePct: 2.4 },
        { fuel: "INTFR", mw: 4_100, sharePct: 12.4 },
        { fuel: "INTNED", mw: 2_000, sharePct: 6.0 },
      ],
    },
  };
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
      stamp: "Sat 10 Oct 2026, 12:00 BST",
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

