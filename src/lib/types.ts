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

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "1y";

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
  | "commodities";
