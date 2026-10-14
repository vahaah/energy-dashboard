import { filterCanonicalCommodityPrices } from "@/lib/commodity-series";
import {
  getHeadlineGenerationQueryParams,
  getHeadlineSnapshotsQueryParams,
  getPricesQueryParams,
} from "@/lib/dashboard-data";
import {
  EMBEDDED_ALIGN_WINDOW_MS,
  isBatteryFuel,
  isEmbeddedFuel,
  isInterconnectorFuel,
  isPumpedStorageFuel,
  mapGenerationFuelToStackKey,
  normalizeFuelType,
} from "@/lib/dashboard-model";
import { assessPublication, type DataState, type PublicationMark, type StalenessSchedule } from "@/lib/data-state";
import { parseUtcDateTime, utcIsoFromTimestamp } from "@/lib/london-time";
import { METRICS, metricSourceIds, metricSourceLabel, type MetricId } from "@/lib/metrics";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { CommodityPrice, EnergySnapshot, Generation5min } from "@/lib/types";
import { peekWarmedEnvelope } from "@/lib/warm-envelope";

export type DataHealthReading = {
  metric_id: MetricId;
  label: string;
  unit: string;
  source: string;
  dataset_id: string;
  expected_cadence: string;
  value: number | null;
  value_label: string;
  published_at: string | null;
  retrieved_at: string | null;
  published_label: string;
  retrieved_label: string;
  stale: boolean;
  state: DataState | null;
};

export type HealthMetric = {
  metric_id: string;
  expected_cadence: string;
  published_at: string | null;
  retrieved_at: string | null;
  stale: boolean;
  state: DataState | null;
};

const FEATURED_METRIC_IDS = ["elec.gb.demand.itsdo", "commodity.gb_gas_sap.price"] as const;

export type FeaturedMetricId = (typeof FEATURED_METRIC_IDS)[number];

export function featuredMetricIds(): readonly FeaturedMetricId[] {
  return FEATURED_METRIC_IDS;
}

export function metricLabel(id: MetricId): string {
  switch (id) {
    case "elec.gb.demand.itsdo":
      return "Demand";
    case "elec.gb.generation.gas":
      return "Gas generation";
    case "elec.gb.generation.coal":
      return "Coal generation";
    case "elec.gb.generation.oil":
      return "Oil generation";
    case "elec.gb.generation.nuclear":
      return "Nuclear generation";
    case "elec.gb.generation.biomass":
      return "Biomass generation";
    case "elec.gb.generation.hydro":
      return "Hydro generation";
    case "elec.gb.generation.other":
      return "Other generation";
    case "elec.gb.generation.wind":
      return "Wind generation";
    case "elec.gb.generation.embedded_wind":
      return "Embedded wind";
    case "elec.gb.generation.solar":
      return "Solar generation";
    case "elec.gb.generation.pumped_storage":
      return "Pumped storage";
    case "elec.gb.generation.battery":
      return "Battery discharge";
    case "elec.gb.generation.balance":
      return "Generation balance";
    case "elec.gb.imports.fuelinst":
      return "Imports";
    case "elec.gb.exports.fuelinst":
      return "Exports";
    case "elec.gb.storage.charging":
      return "Storage charging";
    case "elec.gb.carbon.intensity":
      return "Carbon intensity";
    case "elec.gb.share.wind_solar_hydro":
      return "Wind, solar and hydro share";
    case "elec.gb.price.market_index":
      return "Market index";
    case "elec.gb.price.imbalance":
      return "Imbalance price";
    case "commodity.brent.spot":
      return "Brent";
    case "commodity.wti.spot":
      return "WTI";
    case "commodity.henry_hub.spot":
      return "Henry Hub";
    case "commodity.eu_natural_gas.spot":
      return "Europe natural gas";
    case "commodity.lng_asia.spot":
      return "Japan LNG";
    case "commodity.gb_gas_sap.price":
      return "GB gas SAP";
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

export function buildReading(input: {
  metricId: MetricId;
  value: number | null;
  publishedAt: string | null;
  retrievedAt: string | null;
  now: Date;
  publicationStatus?: PublicationMark | null;
}): DataHealthReading {
  const metric = METRICS[input.metricId];
  const assessed = assessPublication({
    value: input.value,
    publishedAt: input.publishedAt,
    retrievedAt: input.retrievedAt,
    expectedCadence: metric.expected_cadence,
    now: input.now,
    publicationStatus: input.publicationStatus,
    formatValue: (value) => formatReadingValue(value, metric.unit),
    schedule: stalenessSchedule(metric),
  });
  return {
    metric_id: input.metricId,
    label: metricLabel(input.metricId),
    unit: metric.unit,
    source: metricSourceLabel(metric),
    dataset_id: metric.dataset_id,
    expected_cadence: metric.expected_cadence,
    value: input.value != null && Number.isFinite(input.value) ? input.value : null,
    value_label: assessed.valueLabel,
    published_at: input.publishedAt,
    retrieved_at: input.retrievedAt,
    published_label: assessed.publishedLabel,
    retrieved_label: assessed.retrievedLabel,
    stale: assessed.stale,
    state: assessed.state,
  };
}

export function healthMetrics(readings: DataHealthReading[]): HealthMetric[] {
  return readings.map((reading) => ({
    metric_id: reading.metric_id,
    expected_cadence: reading.expected_cadence,
    published_at: reading.published_at,
    retrieved_at: reading.retrieved_at,
    stale: reading.stale,
    state: reading.state,
  }));
}

type Observed = {
  value: number | null;
  publishedAt: string | null;
  retrievedAt: string | null;
};

const DAILY_PRICE_RANGE = "30d";
const MONTHLY_PRICE_RANGE = "1y";

const BALANCE_COMPONENT_IDS = [
  "elec.gb.generation.gas",
  "elec.gb.generation.coal",
  "elec.gb.generation.oil",
  "elec.gb.generation.nuclear",
  "elec.gb.generation.biomass",
  "elec.gb.generation.hydro",
  "elec.gb.generation.other",
  "elec.gb.generation.wind",
  "elec.gb.generation.embedded_wind",
  "elec.gb.generation.solar",
  "elec.gb.generation.pumped_storage",
  "elec.gb.generation.battery",
] as const satisfies readonly MetricId[];

const SHARE_COMPONENT_IDS = [
  "elec.gb.generation.wind",
  "elec.gb.generation.embedded_wind",
  "elec.gb.generation.solar",
  "elec.gb.generation.hydro",
] as const satisfies readonly MetricId[];

const LEADING_COMPONENT_IDS = new Set<MetricId>([
  "elec.gb.generation.embedded_wind",
  "elec.gb.generation.solar",
]);

export async function loadDataHealth(now = new Date()): Promise<DataHealthReading[]> {
  const [snapshots, generation, dailyPrices, monthlyPrices] = await Promise.all([
    peekWarmedEnvelope<EnergySnapshot>("snapshots_range", getHeadlineSnapshotsQueryParams(now), {
      range: "24h",
      now,
    }),
    peekWarmedEnvelope<Generation5min>("generation_5min_range", getHeadlineGenerationQueryParams(now), {
      range: "24h",
      now,
    }),
    peekWarmedEnvelope<CommodityPrice>("prices_range", getPricesQueryParams(DAILY_PRICE_RANGE, now), {
      range: DAILY_PRICE_RANGE,
      now,
    }),
    peekWarmedEnvelope<CommodityPrice>("prices_range", getPricesQueryParams(MONTHLY_PRICE_RANGE, now), {
      range: MONTHLY_PRICE_RANGE,
      now,
    }),
  ]);

  const snapshotRows = snapshots?.data ?? [];
  const generationRows = generation?.data ?? [];
  const dailyBook = priceBook(dailyPrices);
  const monthlyBook = monthlyPrices ? priceBook(monthlyPrices) : null;
  const retrieved = {
    snapshot: isoFromCachedAt(snapshots?.cachedAt),
    generation: isoFromCachedAt(generation?.cachedAt),
  };

  const observed = new Map<MetricId, Observed>();
  for (const metricId of Object.keys(METRICS) as MetricId[]) {
    if (seriesKind(metricId) === "derived") {
      continue;
    }
    const prices = priceBookFor(metricId, dailyBook, monthlyBook);
    observed.set(
      metricId,
      observeMetric(metricId, snapshotRows, generationRows, prices.rows, {
        snapshot: retrieved.snapshot,
        generation: retrieved.generation,
        prices: prices.retrievedAt,
      }, now)
    );
  }

  const aligned = alignedGeneration(observed, retrieved.generation);
  observed.set("elec.gb.generation.balance", aligned.balance);
  observed.set("elec.gb.share.wind_solar_hydro", aligned.share);

  return (Object.keys(METRICS) as MetricId[]).map((metricId) => {
    const row = observed.get(metricId) ?? { value: null, publishedAt: null, retrievedAt: null };
    return buildReading({
      metricId,
      value: row.value,
      publishedAt: row.publishedAt,
      retrievedAt: row.retrievedAt,
      now,
    });
  });
}

function priceBook(envelope: { data: CommodityPrice[]; cachedAt: number } | null): {
  rows: CommodityPrice[];
  retrievedAt: string | null;
} {
  return {
    rows: filterCanonicalCommodityPrices(envelope?.data ?? []),
    retrievedAt: isoFromCachedAt(envelope?.cachedAt),
  };
}

function priceBookFor(
  metricId: MetricId,
  daily: { rows: CommodityPrice[]; retrievedAt: string | null },
  monthly: { rows: CommodityPrice[]; retrievedAt: string | null } | null
): { rows: CommodityPrice[]; retrievedAt: string | null } {
  const cadence = METRICS[metricId].expected_cadence;
  if ((cadence === "P1M" || cadence === "P1Y") && monthly) {
    return monthly;
  }
  return daily;
}

function alignedGeneration(
  observed: ReadonlyMap<MetricId, Observed>,
  retrievedAt: string | null
): { balance: Observed; share: Observed } {
  const empty: Observed = { value: null, publishedAt: null, retrievedAt };
  const anchor = latestPlantObservation(observed);
  if (!anchor?.publishedAt || anchor.value == null) {
    return { balance: empty, share: empty };
  }
  const anchorMs = parseUtcDateTime(anchor.publishedAt).getTime();
  if (Number.isNaN(anchorMs)) {
    return { balance: empty, share: empty };
  }
  const periodStart = getSettlementPeriod(new Date(anchorMs)).startUtc.getTime();
  const latestMs = anchorMs + EMBEDDED_ALIGN_WINDOW_MS;
  const balanceParts = includedObservations(BALANCE_COMPONENT_IDS, observed, periodStart, latestMs);
  if (balanceParts.length === 0) {
    return { balance: empty, share: empty };
  }
  const balanceValue = balanceParts.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const shareParts = includedObservations(SHARE_COMPONENT_IDS, observed, periodStart, latestMs);
  const publishedAt = new Date(periodStart).toISOString();
  return {
    balance: { value: balanceValue, publishedAt, retrievedAt },
    share: {
      value:
        balanceValue > 0 && shareParts.length > 0
          ? (shareParts.reduce((sum, row) => sum + (row.value ?? 0), 0) / balanceValue) * 100
          : null,
      publishedAt,
      retrievedAt,
    },
  };
}

function latestPlantObservation(observed: ReadonlyMap<MetricId, Observed>): Observed | null {
  let latest: Observed | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const metricId of BALANCE_COMPONENT_IDS) {
    if (LEADING_COMPONENT_IDS.has(metricId)) {
      continue;
    }
    const row = observed.get(metricId);
    if (!row?.publishedAt || row.value == null) {
      continue;
    }
    const ms = parseUtcDateTime(row.publishedAt).getTime();
    if (Number.isNaN(ms) || ms < latestMs) {
      continue;
    }
    latestMs = ms;
    latest = row;
  }
  return latest;
}

function includedObservations(
  ids: readonly MetricId[],
  observed: ReadonlyMap<MetricId, Observed>,
  periodStart: number,
  latestMs: number
): Observed[] {
  const rows: Observed[] = [];
  for (const metricId of ids) {
    const row = observed.get(metricId);
    if (!row?.publishedAt || row.value == null || !Number.isFinite(row.value)) {
      continue;
    }
    const ms = parseUtcDateTime(row.publishedAt).getTime();
    if (Number.isNaN(ms) || ms < periodStart || ms > latestMs) {
      continue;
    }
    rows.push(row);
  }
  return rows;
}

function stalenessSchedule(metric: (typeof METRICS)[MetricId]): StalenessSchedule {
  if (metric.interval_convention === "uk_settlement_period_half_open") {
    return "settlement";
  }
  if (metricSourceIds(metric).includes("eia") && /^P\d+D$/.test(metric.expected_cadence)) {
    return "business_day";
  }
  return "calendar";
}

function isoFromCachedAt(cachedAt: number | undefined): string | null {
  if (cachedAt == null || !Number.isFinite(cachedAt)) {
    return null;
  }
  return new Date(cachedAt).toISOString();
}

function observeMetric(
  metricId: MetricId,
  snapshots: EnergySnapshot[],
  generation: Generation5min[],
  prices: CommodityPrice[],
  retrieved: { snapshot: string | null; generation: string | null; prices: string | null },
  now: Date
): Observed {
  const kind = seriesKind(metricId);
  switch (kind) {
    case "snapshot":
      return observeSnapshot(metricId, snapshots, retrieved.snapshot, now);
    case "generation":
      return observeGeneration(metricId, generation, retrieved.generation, now);
    case "commodity":
      return observeCommodity(metricId, prices, retrieved.prices);
    case "derived":
      return { value: null, publishedAt: null, retrievedAt: null };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

type SeriesKind = "snapshot" | "generation" | "commodity" | "derived";

function seriesKind(id: MetricId): SeriesKind {
  switch (id) {
    case "elec.gb.demand.itsdo":
    case "elec.gb.carbon.intensity":
    case "elec.gb.price.market_index":
    case "elec.gb.price.imbalance":
      return "snapshot";
    case "commodity.brent.spot":
    case "commodity.wti.spot":
    case "commodity.henry_hub.spot":
    case "commodity.eu_natural_gas.spot":
    case "commodity.lng_asia.spot":
    case "commodity.gb_gas_sap.price":
      return "commodity";
    case "elec.gb.generation.balance":
    case "elec.gb.share.wind_solar_hydro":
      return "derived";
    case "elec.gb.generation.gas":
    case "elec.gb.generation.coal":
    case "elec.gb.generation.oil":
    case "elec.gb.generation.nuclear":
    case "elec.gb.generation.biomass":
    case "elec.gb.generation.hydro":
    case "elec.gb.generation.other":
    case "elec.gb.generation.wind":
    case "elec.gb.generation.embedded_wind":
    case "elec.gb.generation.solar":
    case "elec.gb.generation.pumped_storage":
    case "elec.gb.generation.battery":
    case "elec.gb.imports.fuelinst":
    case "elec.gb.exports.fuelinst":
    case "elec.gb.storage.charging":
      return "generation";
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

function observeSnapshot(
  metricId: MetricId,
  rows: EnergySnapshot[],
  retrievedAt: string | null,
  now: Date
): Observed {
  const field = snapshotField(metricId);
  let bestMs = Number.NEGATIVE_INFINITY;
  let value: number | null = null;
  let publishedAt: string | null = null;
  for (const row of rows) {
    const raw = row[field];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }
    const ms = parseUtcDateTime(row.timestamp).getTime();
    if (Number.isNaN(ms) || ms > now.getTime() || ms < bestMs) {
      continue;
    }
    bestMs = ms;
    value = raw;
    publishedAt = utcIsoFromTimestamp(row.timestamp) ?? null;
  }
  return { value, publishedAt, retrievedAt };
}

function snapshotField(
  metricId: MetricId
): "demand_mw" | "carbon_intensity" | "price_mid_gbp_mwh" | "price_gbp_mwh" {
  switch (metricId) {
    case "elec.gb.demand.itsdo":
      return "demand_mw";
    case "elec.gb.carbon.intensity":
      return "carbon_intensity";
    case "elec.gb.price.market_index":
      return "price_mid_gbp_mwh";
    case "elec.gb.price.imbalance":
      return "price_gbp_mwh";
    default:
      return "demand_mw";
  }
}

function observeGeneration(
  metricId: MetricId,
  rows: Generation5min[],
  retrievedAt: string | null,
  now: Date
): Observed {
  let bestMs = Number.NEGATIVE_INFINITY;
  const matched: Generation5min[] = [];
  for (const row of rows) {
    if (!generationMatches(metricId, row)) {
      continue;
    }
    const ms = parseUtcDateTime(row.timestamp).getTime();
    if (Number.isNaN(ms) || ms > now.getTime()) {
      continue;
    }
    if (ms > bestMs) {
      bestMs = ms;
      matched.length = 0;
      matched.push(row);
      continue;
    }
    if (ms === bestMs) {
      matched.push(row);
    }
  }
  if (matched.length === 0) {
    return { value: null, publishedAt: null, retrievedAt };
  }
  const value = matched.reduce((sum, row) => sum + generationValue(metricId, row.generation_mw), 0);
  return {
    value,
    publishedAt: utcIsoFromTimestamp(matched[0]?.timestamp) ?? null,
    retrievedAt,
  };
}

function generationValue(metricId: MetricId, mw: number): number {
  switch (metricId) {
    case "elec.gb.exports.fuelinst":
    case "elec.gb.storage.charging":
      return Math.abs(mw);
    default:
      return mw;
  }
}

function generationMatches(metricId: MetricId, row: Generation5min): boolean {
  const fuel = mapGenerationFuelToStackKey(row.fuel_type);
  switch (metricId) {
    case "elec.gb.generation.gas":
      return fuel === "gas";
    case "elec.gb.generation.coal":
      return fuel === "coal";
    case "elec.gb.generation.oil":
      return fuel === "oil";
    case "elec.gb.generation.nuclear":
      return fuel === "nuclear";
    case "elec.gb.generation.biomass":
      return fuel === "biomass";
    case "elec.gb.generation.hydro":
      return fuel === "hydro";
    case "elec.gb.generation.other":
      return fuel === "other";
    case "elec.gb.generation.wind":
      return fuel === "wind" && !isEmbeddedFuel(row.fuel_type);
    case "elec.gb.generation.embedded_wind":
      return normalizeFuelType(row.fuel_type) === "embedded_wind";
    case "elec.gb.generation.solar":
      return normalizeFuelType(row.fuel_type) === "embedded_solar" || fuel === "solar";
    case "elec.gb.generation.pumped_storage":
      return isPumpedStorageFuel(row.fuel_type) && row.generation_mw >= 0;
    case "elec.gb.generation.battery":
      return isBatteryFuel(row.fuel_type) && row.generation_mw >= 0;
    case "elec.gb.imports.fuelinst":
      return isInterconnectorFuel(row.fuel_type) && row.generation_mw > 0;
    case "elec.gb.exports.fuelinst":
      return isInterconnectorFuel(row.fuel_type) && row.generation_mw < 0;
    case "elec.gb.storage.charging":
      return (
        (isPumpedStorageFuel(row.fuel_type) || isBatteryFuel(row.fuel_type)) && row.generation_mw < 0
      );
    default:
      return false;
  }
}

function observeCommodity(
  metricId: MetricId,
  rows: CommodityPrice[],
  retrievedAt: string | null
): Observed {
  const commodity = commodityKey(metricId);
  let bestDate = "";
  let value: number | null = null;
  for (const row of rows) {
    if (row.commodity !== commodity || !Number.isFinite(row.price)) {
      continue;
    }
    const date = row.date.slice(0, 10);
    if (date < bestDate) {
      continue;
    }
    bestDate = date;
    value = row.price;
  }
  return {
    value,
    publishedAt: bestDate ? `${bestDate}T00:00:00.000Z` : null,
    retrievedAt,
  };
}

function commodityKey(metricId: MetricId): string {
  switch (metricId) {
    case "commodity.brent.spot":
      return "brent_crude";
    case "commodity.wti.spot":
      return "wti_crude";
    case "commodity.henry_hub.spot":
      return "henry_hub_gas";
    case "commodity.eu_natural_gas.spot":
      return "eu_natural_gas";
    case "commodity.lng_asia.spot":
      return "lng_asia";
    case "commodity.gb_gas_sap.price":
      return "gb_gas_sap";
    default:
      return "";
  }
}

function formatReadingValue(value: number, unit: string): string {
  const digits = unit === "MW" || unit === "%" || unit === "gCO₂/kWh" ? 0 : 2;
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value);
}
