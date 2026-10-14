import type { DataSourceId } from "@/lib/attribution";
import {
  CARBON_RECORD_BASIS,
  COAL_POWER_ENDED,
  COAL_RECORD_BASIS,
  NESO_HISTORIC_SOURCE,
  NESO_HISTORIC_START_YEAR,
  SOLAR_RECORD_BASIS,
  WIND_RECORD_BASIS,
} from "@/lib/historic-mix";
import { formatLondonDayMonthYear } from "@/lib/london-time";
import type {
  Aggregation,
  IntervalConvention,
  MetricDefinition,
  QuantityKind,
  SignConvention,
} from "@/lib/types";

/**
 * Checked-in contract for every series the UI can name.
 * Types live in `src/lib/types.ts`. Intervals are UTC and half-open.
 */

export const QUANTITY_KINDS = [
  "instantaneous_rate",
  "interval_total",
  "cumulative",
  "stock",
  "index",
  "share",
] as const satisfies readonly QuantityKind[];

export const AGGREGATIONS = ["mean", "sum", "last", "ratio"] as const satisfies readonly Aggregation[];

export const INTERVAL_CONVENTIONS = [
  "uk_settlement_period_half_open",
  "calendar_day_utc_half_open",
  "calendar_month_utc_half_open",
  "gas_day_half_open",
] as const satisfies readonly IntervalConvention[];

export const SIGN_CONVENTIONS = [
  "positive_demand",
  "positive_generation",
  "positive_import_to_gb",
  "positive_export_from_gb",
  "positive_storage_charging",
  "positive_intensity",
  "positive_price",
  "share_of_denominator",
] as const satisfies readonly SignConvention[];

const GEOGRAPHY_ID =
  /^(?:GB|NI|UK|IE|ALL_ISLAND|GB_NTS|GB_DNO_[0-9]+|GB_GSP_[A-Z0-9]+|ONS_[A-Z][A-Z0-9]*_[A-Z0-9]+|US|NW_EUROPE|JP|GLOBAL)$/;

export function isGeographyId(value: string): boolean {
  if (value.toLowerCase().includes("national")) {
    return false;
  }
  return GEOGRAPHY_ID.test(value);
}

const SOURCE_LABEL: Record<DataSourceId, string> = {
  "elexon-bmrs": "Elexon BMRS",
  "neso-open-data": "NESO",
  "carbon-intensity": "Carbon Intensity API",
  "sheffield-pv-live": "Sheffield Solar PV Live",
  eia: "U.S. Energy Information Administration",
  "world-bank-pink-sheet": "World Bank Pink Sheet",
  "national-gas": "National Gas",
  "desnz-repd": "DESNZ REPD",
  "desnz-dukes": "DESNZ DUKES",
};

export function metricSourceIds(metric: MetricDefinition): readonly DataSourceId[] {
  return typeof metric.source_id === "string" ? [metric.source_id] : metric.source_id;
}

export function metricSourceLabel(metric: MetricDefinition): string {
  return metricSourceIds(metric)
    .map((id) => SOURCE_LABEL[id])
    .join(", ");
}

const GB_MW = {
  metric_definition_version: 1,
  unit: "MW",
  quantity_kind: "instantaneous_rate",
  geography_id: "GB",
  interval_convention: "uk_settlement_period_half_open",
  aggregation: "mean",
  denominator: null,
  expected_cadence: "PT30M",
  publication_lag: "PT0S",
} as const;

const HEADLINE_SOURCES = ["elexon-bmrs", "neso-open-data", "sheffield-pv-live"] as const;

export const METRICS = {
  "elec.gb.demand.itsdo": {
    ...GB_MW,
    metric_id: "elec.gb.demand.itsdo",
    sign_convention: "positive_demand",
    source_id: "elexon-bmrs",
    dataset_id: "ITSDO",
    coverage: "Initial Transmission System Demand Outturn for the GB transmission system.",
  },
  "elec.gb.generation.gas": {
    ...GB_MW,
    metric_id: "elec.gb.generation.gas",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "CCGT and OCGT. The homepage gas row.",
  },
  "elec.gb.generation.coal": {
    ...GB_MW,
    metric_id: "elec.gb.generation.coal",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Coal-fired generation.",
  },
  "elec.gb.generation.oil": {
    ...GB_MW,
    metric_id: "elec.gb.generation.oil",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Oil-fired generation.",
  },
  "elec.gb.generation.nuclear": {
    ...GB_MW,
    metric_id: "elec.gb.generation.nuclear",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Nuclear generation.",
  },
  "elec.gb.generation.biomass": {
    ...GB_MW,
    metric_id: "elec.gb.generation.biomass",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Biomass generation. Not in elec.gb.share.wind_solar_hydro.",
  },
  "elec.gb.generation.hydro": {
    ...GB_MW,
    metric_id: "elec.gb.generation.hydro",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Conventional hydro. Not pumped storage.",
  },
  "elec.gb.generation.other": {
    ...GB_MW,
    metric_id: "elec.gb.generation.other",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "FUELINST generation that does not fit a named fuel.",
  },
  "elec.gb.generation.wind": {
    ...GB_MW,
    metric_id: "elec.gb.generation.wind",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Transmission-connected wind. Embedded wind is elec.gb.generation.embedded_wind.",
  },
  "elec.gb.generation.embedded_wind": {
    ...GB_MW,
    metric_id: "elec.gb.generation.embedded_wind",
    sign_convention: "positive_generation",
    source_id: "neso-open-data",
    dataset_id: "177f6fa4-ae49-4182-81ea-0c6b35f26ca6",
    coverage: "NESO embedded wind outturn for the settlement period.",
  },
  "elec.gb.generation.solar": {
    ...GB_MW,
    metric_id: "elec.gb.generation.solar",
    sign_convention: "positive_generation",
    source_id: "sheffield-pv-live",
    dataset_id: "pvlive-gsp-0",
    coverage: "Sheffield Solar PV Live national series, GSP 0, including embedded solar.",
  },
  "elec.gb.generation.pumped_storage": {
    ...GB_MW,
    metric_id: "elec.gb.generation.pumped_storage",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Pumped storage discharge. Pumping is elec.gb.storage.charging, not this series.",
  },
  "elec.gb.generation.battery": {
    ...GB_MW,
    metric_id: "elec.gb.generation.battery",
    sign_convention: "positive_generation",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage: "Battery discharge when FUELINST publishes it. Charging is not this series.",
  },
  "elec.gb.generation.balance": {
    ...GB_MW,
    metric_id: "elec.gb.generation.balance",
    sign_convention: "positive_generation",
    source_id: HEADLINE_SOURCES,
    dataset_id: "headline-balance",
    coverage:
      "Generation side of the headline balance for one settlement period. Plant plus embedded wind and solar, including storage discharge. Excludes interconnectors and storage charging. Time rollup is the half-hour mean, not a sum across periods.",
  },
  "elec.gb.imports.fuelinst": {
    ...GB_MW,
    metric_id: "elec.gb.imports.fuelinst",
    sign_convention: "positive_import_to_gb",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage:
      "Positive FUELINST INT* is an import into GB. A separate series from generation. Exports are elec.gb.exports.fuelinst.",
  },
  "elec.gb.exports.fuelinst": {
    ...GB_MW,
    metric_id: "elec.gb.exports.fuelinst",
    sign_convention: "positive_export_from_gb",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage:
      "FUELINST INT* flow out of GB, as a positive magnitude. Separate from generation and from elec.gb.imports.fuelinst.",
  },
  "elec.gb.storage.charging": {
    ...GB_MW,
    metric_id: "elec.gb.storage.charging",
    sign_convention: "positive_storage_charging",
    source_id: "elexon-bmrs",
    dataset_id: "FUELINST",
    coverage:
      "Storage charging as a headline-balance term: pumped-storage pumping plus battery charging when published. Positive, and subtracted in the balance. Not a generation fuel.",
  },
  "elec.gb.carbon.intensity": {
    metric_id: "elec.gb.carbon.intensity",
    metric_definition_version: 1,
    unit: "gCO₂/kWh",
    quantity_kind: "index",
    geography_id: "GB",
    interval_convention: "uk_settlement_period_half_open",
    sign_convention: "positive_intensity",
    aggregation: "mean",
    denominator: null,
    source_id: "carbon-intensity",
    dataset_id: "intensity-actual",
    coverage: "Actual half-hour carbon intensity. Not the forecast series.",
    expected_cadence: "PT30M",
    publication_lag: "PT0S",
  },
  "elec.gb.share.wind_solar_hydro": {
    metric_id: "elec.gb.share.wind_solar_hydro",
    metric_definition_version: 1,
    unit: "%",
    quantity_kind: "share",
    geography_id: "GB",
    interval_convention: "uk_settlement_period_half_open",
    sign_convention: "share_of_denominator",
    aggregation: "ratio",
    denominator: "elec.gb.generation.balance",
    source_id: HEADLINE_SOURCES,
    dataset_id: "headline-balance",
    coverage:
      "Transmission wind + embedded wind + PV Live solar + conventional hydro, over the generation side of the headline balance for the same settlement period. Excludes biomass, pumped storage, battery and imports.",
    expected_cadence: "PT30M",
    publication_lag: "PT0S",
  },
  "elec.gb.price.market_index": {
    metric_id: "elec.gb.price.market_index",
    metric_definition_version: 1,
    unit: "£/MWh",
    quantity_kind: "index",
    geography_id: "GB",
    interval_convention: "uk_settlement_period_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "elexon-bmrs",
    dataset_id: "APXMIDP",
    coverage:
      "Short-term wholesale Market Index. The homepage field is price_mid_gbp_mwh. Not the day-ahead auction.",
    expected_cadence: "PT30M",
    publication_lag: "PT0S",
  },
  "elec.gb.price.imbalance": {
    metric_id: "elec.gb.price.imbalance",
    metric_definition_version: 1,
    unit: "£/MWh",
    quantity_kind: "index",
    geography_id: "GB",
    interval_convention: "uk_settlement_period_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "elexon-bmrs",
    dataset_id: "system-prices",
    coverage:
      "System buy price, the imbalance cash-out. The homepage field is price_gbp_mwh. The published price can be negative.",
    expected_cadence: "PT30M",
    publication_lag: "PT0S",
  },
  "commodity.brent.spot": {
    metric_id: "commodity.brent.spot",
    metric_definition_version: 1,
    unit: "$/bbl",
    quantity_kind: "index",
    geography_id: "GLOBAL",
    interval_convention: "calendar_day_utc_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "eia",
    dataset_id: "PET.RBRTE.D",
    coverage:
      "EIA Europe Brent spot price FOB (PET.RBRTE.D), a global marker. Stored ingest unit is $/BBL. EIA releases the daily series weekly, usually Wednesday, through the prior Tuesday. A US holiday can move that release to Thursday.",
    expected_cadence: "P1D",
    publication_lag: "P8D",
  },
  "commodity.wti.spot": {
    metric_id: "commodity.wti.spot",
    metric_definition_version: 1,
    unit: "$/bbl",
    quantity_kind: "index",
    geography_id: "US",
    interval_convention: "calendar_day_utc_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "eia",
    dataset_id: "PET.RWTC.D",
    coverage:
      "Cushing, OK WTI spot price FOB. Stored ingest unit is $/BBL. Same weekly Wednesday EIA spot release as Brent.",
    expected_cadence: "P1D",
    publication_lag: "P8D",
  },
  "commodity.henry_hub.spot": {
    metric_id: "commodity.henry_hub.spot",
    metric_definition_version: 1,
    unit: "$/MMBtu",
    quantity_kind: "index",
    geography_id: "US",
    interval_convention: "calendar_day_utc_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "eia",
    dataset_id: "NG.RNGWHHD.D",
    coverage:
      "Henry Hub spot gas, Louisiana. Stored ingest unit is $/MMBTU. EIA releases this daily series weekly with the petroleum spots, usually Wednesday through the prior Tuesday.",
    expected_cadence: "P1D",
    publication_lag: "P8D",
  },
  "commodity.eu_natural_gas.spot": {
    metric_id: "commodity.eu_natural_gas.spot",
    metric_definition_version: 1,
    unit: "$/MMBtu",
    quantity_kind: "index",
    geography_id: "NW_EUROPE",
    interval_convention: "calendar_month_utc_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "world-bank-pink-sheet",
    dataset_id: "Natural gas, Europe",
    coverage:
      "World Bank Pink Sheet monthly Northwest Europe natural gas. The prior month is published in early month+1.",
    expected_cadence: "P1M",
    publication_lag: "P1M",
  },
  "commodity.lng_asia.spot": {
    metric_id: "commodity.lng_asia.spot",
    metric_definition_version: 1,
    unit: "$/MMBtu",
    quantity_kind: "index",
    geography_id: "JP",
    interval_convention: "calendar_month_utc_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "world-bank-pink-sheet",
    dataset_id: "Liquefied natural gas, Japan",
    coverage:
      "World Bank Pink Sheet monthly Japan LNG import price. The prior month is published in early month+1.",
    expected_cadence: "P1M",
    publication_lag: "P1M",
  },
  "commodity.gb_gas_sap.price": {
    metric_id: "commodity.gb_gas_sap.price",
    metric_definition_version: 1,
    unit: "p/kWh",
    quantity_kind: "index",
    geography_id: "GB_NTS",
    interval_convention: "gas_day_half_open",
    sign_convention: "positive_price",
    aggregation: "last",
    denominator: null,
    source_id: "national-gas",
    dataset_id: "PUBOB603",
    coverage:
      "National Gas System Average Price for the GB transmission system, pence per kWh. Gas day D is published on D+1.",
    expected_cadence: "P1D",
    publication_lag: "P1D",
  },
} satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRICS;

export function metricById(id: MetricId): MetricDefinition {
  return METRICS[id];
}

/** Homepage Demand figure. The megawatt path is unchanged; GW is MW / 1000. */
export function homepageDemandFigureInputs(): {
  metric_id: "elec.gb.demand.itsdo";
  unit: string;
  displayUnit: string;
  geography_id: string;
  source: string;
} {
  const metric = METRICS["elec.gb.demand.itsdo"];
  return {
    metric_id: "elec.gb.demand.itsdo",
    unit: metric.unit,
    displayUnit: metric.unit === "MW" ? "GW" : metric.unit,
    geography_id: metric.geography_id,
    source: metricSourceLabel(metric),
  };
}

export type RecordMetricId =
  | "wind"
  | "solar"
  | "carbon"
  | "renewable_share"
  | "zero_carbon_share"
  | "coal_end";

export type RecordMetric = {
  id: RecordMetricId;
  source: string;
  /** Inclusive ISO date the published series starts. */
  startDate: string;
  interval: string;
  method: string;
};

const HISTORIC_START = `${NESO_HISTORIC_START_YEAR}-01-01`;

export const RECORD_METRICS: Record<RecordMetricId, RecordMetric> = {
  wind: {
    id: "wind",
    source: NESO_HISTORIC_SOURCE,
    startDate: HISTORIC_START,
    interval: "Half-hour",
    method: WIND_RECORD_BASIS,
  },
  solar: {
    id: "solar",
    source: NESO_HISTORIC_SOURCE,
    startDate: HISTORIC_START,
    interval: "Half-hour",
    method: SOLAR_RECORD_BASIS,
  },
  carbon: {
    id: "carbon",
    source: NESO_HISTORIC_SOURCE,
    startDate: HISTORIC_START,
    interval: "Half-hour",
    method: CARBON_RECORD_BASIS,
  },
  renewable_share: {
    id: "renewable_share",
    source: NESO_HISTORIC_SOURCE,
    startDate: HISTORIC_START,
    interval: "Half-hour",
    method: "Renewable share of NESO historic generation (wind, solar and hydro).",
  },
  zero_carbon_share: {
    id: "zero_carbon_share",
    source: NESO_HISTORIC_SOURCE,
    startDate: HISTORIC_START,
    interval: "Half-hour",
    method: "Zero-carbon share computed as wind + solar + hydro + nuclear, divided by NESO generation.",
  },
  coal_end: {
    id: "coal_end",
    source: "Uniper, Ratcliffe-on-Soar",
    startDate: COAL_POWER_ENDED,
    interval: "Day",
    method: COAL_RECORD_BASIS,
  },
};

export function metricProvenance(metric: RecordMetric): string {
  return `${metric.source}. From ${formatLondonDayMonthYear(metric.startDate)}. ${metric.interval}. ${metric.method}`;
}
