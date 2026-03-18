// ─── Tinybird row types ─────────────────────────────────────

export interface EnergySnapshot {
  timestamp: string;
  carbon_intensity: number;
  carbon_forecast: number;
  carbon_index: string;
  demand_mw: number;
  price_gbp_mwh: number;
  gen_gas_pct: number;
  gen_coal_pct: number;
  gen_nuclear_pct: number;
  gen_wind_pct: number;
  gen_solar_pct: number;
  gen_hydro_pct: number;
  gen_biomass_pct: number;
  gen_imports_pct: number;
  gen_other_pct: number;
  gen_gas_mw: number;
  gen_coal_mw: number;
  gen_nuclear_mw: number;
  gen_wind_mw: number;
  gen_solar_mw: number;
  gen_hydro_mw: number;
  gen_biomass_mw: number;
  gen_other_mw: number;
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
      actual: number;
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

// ─── 5-minute generation (FUELINST + NESO) ─────────────────

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
