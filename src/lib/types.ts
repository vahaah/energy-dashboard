import type { DataSourceId } from "@/lib/attribution";

// ─── Metric registry ────────────────────────────────────────

export type QuantityKind =
  | "instantaneous_rate"
  | "interval_total"
  | "cumulative"
  | "stock"
  | "index"
  | "share";

export type Aggregation = "mean" | "sum" | "last" | "ratio";

export type IntervalConvention =
  | "uk_settlement_period_half_open"
  | "calendar_day_utc_half_open"
  | "calendar_month_utc_half_open"
  | "gas_day_half_open";

export type SignConvention =
  | "positive_demand"
  | "positive_generation"
  | "positive_import_to_gb"
  | "positive_export_from_gb"
  | "positive_storage_charging"
  | "positive_intensity"
  | "positive_price"
  | "share_of_denominator";

/** Measured series are post-event. Forecast series are a snapshot issued ahead of the interval. */
export type SeriesKind = "measured" | "forecast";

export type MetricSourceId = DataSourceId | readonly DataSourceId[];

export type MetricDefinition = {
  metric_id: string;
  metric_definition_version: number;
  unit: string;
  quantity_kind: QuantityKind;
  geography_id: string;
  interval_convention: IntervalConvention;
  sign_convention: SignConvention;
  aggregation: Aggregation;
  /** Required for every share or percent. Null otherwise. */
  denominator: string | null;
  source_id: MetricSourceId;
  dataset_id: string;
  coverage: string;
  expected_cadence: string;
  /**
   * How long after the interval the publisher normally releases it.
   * Shown on /data-health and returned by /api/v1/data-health. Not the stale clock.
   */
  publication_lag: string;
  /**
   * Wider window used only when deciding stale. Omitted when staleness uses publication_lag.
   * Not shown in the UI or the data-health API.
   */
  stale_grace?: string;
};

/**
 * UTC half-open interval. `value` is null when the period was not observed.
 * No runtime constructor: nothing writes these yet.
 */
export type Observation = {
  interval_start: string;
  interval_end: string;
  period_label: string | null;
  time_basis: string;
  value: number | null;
  observation_kind: string;
  publication_status: string;
  forecast_issued_at: string | null;
  published_at: string | null;
  retrieved_at: string | null;
  source_release_id: string | null;
  source_record_key: string | null;
  quality_flags: readonly string[];
};

// ─── Tinybird row types ─────────────────────────────────────

export type NullableNumber = number | null;

export interface EnergySnapshot {
  timestamp: string;
  carbon_intensity: NullableNumber;
  carbon_forecast: NullableNumber;
  carbon_index: string;
  demand_mw: NullableNumber;
  price_gbp_mwh: NullableNumber;
  price_mid_gbp_mwh?: NullableNumber;
  mid_volume_mwh?: NullableNumber;
  gen_gas_pct: NullableNumber;
  gen_coal_pct: NullableNumber;
  gen_nuclear_pct: NullableNumber;
  gen_wind_pct: NullableNumber;
  gen_solar_pct: NullableNumber;
  gen_hydro_pct: NullableNumber;
  gen_biomass_pct: NullableNumber;
  gen_imports_pct: NullableNumber;
  gen_other_pct: NullableNumber;
  gen_gas_mw: NullableNumber;
  gen_coal_mw: NullableNumber;
  gen_nuclear_mw: NullableNumber;
  gen_wind_mw: NullableNumber;
  gen_solar_mw: NullableNumber;
  gen_hydro_mw: NullableNumber;
  gen_biomass_mw: NullableNumber;
  gen_other_mw: NullableNumber;
  gen_pumped_mw?: NullableNumber;
  gen_battery_mw?: NullableNumber;
}

export interface CommodityPrice {
  date: string;
  commodity: string;
  price: number;
  currency: string;
  unit: string;
}

// ─── API response types ─────────────────────────────────────

export interface CarbonIntensityResponse {
  data: Array<{
    from: string;
    to: string;
    intensity: {
      forecast: number;
      actual: number | null;
      index: string;
    };
  }>;
}

export interface GenerationMixResponse {
  data: {
    from: string;
    to: string;
    generationmix: Array<{
      fuel: string;
      perc: number;
    }>;
  };
}

export interface ElexonSystemPrice {
  settlementDate: string;
  settlementPeriod: number;
  startTime: string;
  systemSellPrice: number;
  systemBuyPrice: number;
}

export interface ElexonMarketIndex {
  startTime: string;
  dataProvider: string;
  settlementDate: string;
  settlementPeriod: number;
  price: number;
  volume: number;
}

export interface ElexonDemand {
  dataset: string;
  publishTime: string;
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  demand: number;
}

export interface ElexonGeneration {
  dataset: string;
  publishTime: string;
  businessType: string;
  psrType: string;
  quantity: number;
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
}

export interface EIAPriceData {
  period: string;
  series: string;
  "series-description": string;
  value: number;
  units: string;
}

// ─── 5-minute generation (FUELINST + NESO + PV Live) ────────

export interface Generation5min {
  timestamp: string;
  fuel_type: string;
  generation_mw: number;
  source: string;
}

export interface InterconnectorFlow {
  timestamp: string;
  interconnector: string;
  generation_mw: number;
  direction: "import" | "export";
}

// ─── Dashboard view types ───────────────────────────────────

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "1y" | "all";

export type TinybirdTimeRange = Exclude<TimeRange, "all">;

export interface GenerationMixItem {
  fuel: string;
  pct: number;
  mw: number;
  color: string;
}

export type CommodityRange = "30d" | "90d" | "1y";

export type CommodityScale = "index" | "native";

export type CommodityChartPoint = {
  date: string;
  time: number;
  value: number;
  native: number;
  unit: string;
  commodity: string;
};

export type CommodityChartSeries = {
  commodity: string;
  label: string;
  color: string;
  monthly: boolean;
  points: CommodityChartPoint[];
};

export type CommodityTooltipRow = {
  commodity: string;
  label: string;
  color: string;
  native: number;
  unit: string;
  date: string;
};

export type CommodityYAxis = {
  scale: "log" | "auto";
  domain: [number, number] | undefined;
  ticks: number[] | undefined;
};

export type DashboardFocus =
  | "overview"
  | "carbon"
  | "price"
  | "generation"
  | "transfers"
  | "commodities"
  | "records";

// ─── Look-ahead / forecast types ────────────────────────────

export const WIND_FORECAST_BASIS =
  "Transmission-connected wind only. Embedded wind is not in this forecast.";

export const DEMAND_FORECAST_EMBEDDED_BASIS =
  "Elexon National Demand Forecast plus NESO embedded wind and solar forecast." as const;

export const DEMAND_FORECAST_TRANSMISSION_BASIS =
  "Elexon National Demand Forecast (transmission only; excludes embedded)." as const;

export type DemandForecastBasis =
  | typeof DEMAND_FORECAST_EMBEDDED_BASIS
  | typeof DEMAND_FORECAST_TRANSMISSION_BASIS;

export type ForecastPoint = {
  time: string;
  value: number;
};

export type GreenestWindow = {
  startUtc: string;
  endUtc: string;
  grams: number;
  sentence: string;
};

export type WindLookAhead = {
  tonightGw: number | null;
  tomorrowEveningGw: number | null;
  sparkline: number[];
  sentence: string;
  basis: typeof WIND_FORECAST_BASIS;
};

export type LookAheadView = {
  fetchedAt: string;
  greenest: GreenestWindow | null;
  carbonSeries: ForecastPoint[];
  wind: WindLookAhead | null;
  demandSeries: ForecastPoint[];
  demandBasis: DemandForecastBasis | null;
};

export type PublicLookAhead = {
  fetchedAt: string;
  greenestWindow: GreenestWindow | null;
  wind: {
    tonightGw: number | null;
    tomorrowEveningGw: number | null;
    sentence: string;
    basis: typeof WIND_FORECAST_BASIS;
  } | null;
  demandBasis: DemandForecastBasis | null;
  attribution: {
    carbon: string;
    carbonNote: string;
    elexon: { text: string; licence: string };
    nesoEmbedded: { text: string; licence: string; dataset: string };
  };
};

export type WindForecastRow = {
  startTime: string;
  generation: number | null;
};

export type DemandForecastRow = {
  startTime: string;
  nationalDemand: number | null;
  boundary: string | null;
};

export type EmbeddedForecastRow = {
  settlementDate: string;
  settlementPeriod: number;
  periodEndUtc?: string;
  embeddedWindMw: number | null;
  embeddedSolarMw: number | null;
};

export type CarbonForecastRow = CarbonIntensityResponse["data"][number];

export type CachedForecastRows = {
  fetchedAt: string;
  carbonRows: CarbonForecastRow[] | null;
  windRows: WindForecastRow[] | null;
  demandRows: DemandForecastRow[] | null;
  embeddedRows: EmbeddedForecastRow[] | null;
};
