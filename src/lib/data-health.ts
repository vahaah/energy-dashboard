import { filterCanonicalCommodityPrices } from "@/lib/commodity-series";
import {
  getHeadlineGenerationQueryParams,
  getHeadlineSnapshotsQueryParams,
  getPricesQueryParams,
} from "@/lib/dashboard-data";
import {
  isBatteryFuel,
  isEmbeddedFuel,
  isInterconnectorFuel,
  isPumpedStorageFuel,
  mapGenerationFuelToStackKey,
  normalizeFuelType,
} from "@/lib/dashboard-model";
import { assessPublication, type DataState, type PublicationMark } from "@/lib/data-state";
import { parseUtcDateTime, utcIsoFromTimestamp } from "@/lib/london-time";
import { METRICS, metricSourceLabel, type MetricId } from "@/lib/metrics";
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

export async function loadDataHealth(now = new Date()): Promise<DataHealthReading[]> {
  const [snapshots, generation, prices] = await Promise.all([
    peekWarmedEnvelope<EnergySnapshot>("snapshots_range", getHeadlineSnapshotsQueryParams(now), {
      range: "24h",
      now,
    }),
    peekWarmedEnvelope<Generation5min>("generation_5min_range", getHeadlineGenerationQueryParams(now), {
      range: "24h",
      now,
    }),
    peekWarmedEnvelope<CommodityPrice>("prices_range", getPricesQueryParams("30d", now), {
      range: "30d",
      now,
    }),
  ]);

  const snapshotRows = snapshots?.data ?? [];
  const generationRows = generation?.data ?? [];
  const priceRows = filterCanonicalCommodityPrices(prices?.data ?? []);
  const retrieved = {
    snapshot: isoFromCachedAt(snapshots?.cachedAt),
    generation: isoFromCachedAt(generation?.cachedAt),
    prices: isoFromCachedAt(prices?.cachedAt),
  };

  return (Object.keys(METRICS) as MetricId[]).map((metricId) => {
    const observed = observeMetric(metricId, snapshotRows, generationRows, priceRows, retrieved, now);
    return buildReading({
      metricId,
      value: observed.value,
      publishedAt: observed.publishedAt,
      retrievedAt: observed.retrievedAt,
      now,
    });
  });
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
  let value: number | null = null;
  let publishedAt: string | null = null;
  for (const row of rows) {
    if (!generationMatches(metricId, row)) {
      continue;
    }
    const ms = parseUtcDateTime(row.timestamp).getTime();
    if (Number.isNaN(ms) || ms > now.getTime() || ms < bestMs) {
      continue;
    }
    bestMs = ms;
    value = generationValue(metricId, row.generation_mw);
    publishedAt = utcIsoFromTimestamp(row.timestamp) ?? null;
  }
  return { value, publishedAt, retrievedAt };
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
