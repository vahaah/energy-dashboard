import type { DataSourceId } from "@/lib/attribution";
import { EIRGRID_SERIES, type EirgridSeriesSpec } from "@/lib/eirgrid/spec";
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
  SeriesKind,
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
  "calendar_year_half_open",
  "gas_day_half_open",
  "quarter_hour_half_open",
  "half_hour_half_open",
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
  "negative_transformation_input",
  "signed_as_published",
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
  "neso-dno-areas": "NESO DNO areas",
  "os-open-zoomstack": "OS Open Zoomstack",
  "eirgrid-group": "EirGrid Group",
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
    // Elexon publishes the system price about 48 minutes after the period starts.
    publication_lag: "PT30M",
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
    // Wednesday is 8 days after the prior Tuesday. A US holiday makes it 9.
    publication_lag: "P8D",
    // P8D alone expires Thursday 00:00 UTC, before a holiday-delayed Thursday release.
    stale_grace: "P10D",
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
    stale_grace: "P10D",
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
    stale_grace: "P10D",
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
      "National Gas System Average Price for the GB transmission system, pence per kWh. Gas day D is published on D+1, about 12:30 UTC.",
    expected_cadence: "P1D",
    publication_lag: "P1D",
    // P1D marks gas day D stale from D+2 00:00 UTC, about 12.5 hours before the 12:30 UTC print.
    stale_grace: "P2D",
  },
} satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRICS;

export function metricById(id: MetricId): MetricDefinition {
  return METRICS[id];
}

const GAS_NTS = {
  metric_definition_version: 1,
  geography_id: "GB_NTS",
  interval_convention: "gas_day_half_open",
  denominator: null,
  source_id: "national-gas",
} as const;

const GAS_RATE = {
  ...GAS_NTS,
  quantity_kind: "instantaneous_rate",
  aggregation: "mean",
  expected_cadence: "PT1H",
  publication_lag: "PT10M",
} as const;

const GAS_FORECAST = {
  ...GAS_RATE,
  aggregation: "last",
} as const;

const GAS_DAY_TOTAL = {
  ...GAS_NTS,
  quantity_kind: "interval_total",
  aggregation: "last",
  expected_cadence: "P1D",
  publication_lag: "P1D",
} as const;

const GAS_STOCK_DAY = {
  ...GAS_NTS,
  quantity_kind: "stock",
  aggregation: "last",
  expected_cadence: "P1D",
  publication_lag: "P1D",
} as const;

const GAS_STOCK_HOUR = {
  ...GAS_STOCK_DAY,
  expected_cadence: "PT1H",
  publication_lag: "PT10M",
} as const;

/**
 * Physical NTS series. Kept out of `METRICS` so the homepage registry and
 * `/api/health` stay on the series already shown. `/data-health` appends them
 * from the Blob release. SAP is unchanged.
 */
export const GAS_METRICS = {
  "gas.gb_nts.entry.physical.national": {
    ...GAS_RATE,
    metric_id: "gas.gb_nts.entry.physical.national",
    unit: "mscm/d",
    sign_convention: "positive_generation",
    dataset_id: "PUBOB2042",
    coverage: "Physical entry into the NTS, national, as an mscm/d rate. North and south are the split.",
  },
  "gas.gb_nts.entry.physical.north": {
    ...GAS_RATE,
    metric_id: "gas.gb_nts.entry.physical.north",
    unit: "mscm/d",
    sign_convention: "positive_generation",
    dataset_id: "PUBOB2043",
    coverage: "Physical entry into the NTS for the north zone, as an mscm/d rate.",
  },
  "gas.gb_nts.entry.physical.south": {
    ...GAS_RATE,
    metric_id: "gas.gb_nts.entry.physical.south",
    unit: "mscm/d",
    sign_convention: "positive_generation",
    dataset_id: "PUBOB2044",
    coverage: "Physical entry into the NTS for the south zone, as an mscm/d rate.",
  },
  "gas.gb_nts.entry.forecast": {
    ...GAS_FORECAST,
    metric_id: "gas.gb_nts.entry.forecast",
    unit: "mscm/d",
    sign_convention: "positive_generation",
    dataset_id: "PUBOB19",
    coverage: "Forecast end-of-day aggregate entry, mscm/d. Each row has forecast_issued_at.",
  },
  "gas.gb_nts.demand.actual_energy": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.demand.actual_energy",
    unit: "kWh",
    sign_convention: "positive_demand",
    dataset_id: "PUBOB4422",
    coverage:
      "Catalogue unit is kWh for a gas-day NTS throughput. The autumn 2026 CSV was empty and the January 2025 extract repeated one value, so this series is deferred.",
  },
  "gas.gb_nts.linepack.opening_interim": {
    ...GAS_STOCK_HOUR,
    metric_id: "gas.gb_nts.linepack.opening_interim",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOB29",
    coverage: "Interim opening linepack for the gas day, million standard cubic metres.",
  },
  "gas.gb_nts.linepack.pclp1": {
    ...GAS_STOCK_HOUR,
    metric_id: "gas.gb_nts.linepack.pclp1",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOB30",
    coverage: "Predicted closing linepack (PCLP1), million standard cubic metres.",
  },
  "gas.gb_nts.linepack.pclp2": {
    ...GAS_STOCK_HOUR,
    metric_id: "gas.gb_nts.linepack.pclp2",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOB31",
    coverage: "Predicted closing linepack (PCLP2), million standard cubic metres.",
  },
  "gas.gb_nts.storage.injection": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.storage.injection",
    unit: "kWh",
    sign_convention: "positive_storage_charging",
    dataset_id: "PUBOB4423",
    coverage: "Storage injection for the gas day, kWh. One value per gas day. Positive is injection.",
  },
  "gas.gb_nts.storage.withdrawal": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.storage.withdrawal",
    unit: "kWh",
    sign_convention: "positive_generation",
    dataset_id: "PUBOB4424",
    coverage:
      "Storage withdrawal for the gas day, kWh. One value per gas day. The portal publishes withdrawal negative; the stored value is positive generation.",
  },
  "gas.gb_nts.demand.actual_volume": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.demand.actual_volume",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOB637",
    coverage: "NTS demand for the finished gas day, million standard cubic metres, published on D+1.",
  },
  "gas.gb_nts.supply.physical_volume": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.supply.physical_volume",
    unit: "mscm",
    sign_convention: "positive_generation",
    dataset_id: "PUBOBJ635",
    coverage: "Physical NTS entry for the finished gas day, million standard cubic metres, published on D+1.",
  },
  "gas.gb_nts.supply.physical_energy": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.supply.physical_energy",
    unit: "kWh",
    sign_convention: "positive_generation",
    dataset_id: "PUBOBJ636",
    coverage: "Physical NTS entry for the finished gas day, kWh, published on D+1.",
  },
  "gas.gb_nts.linepack.opening": {
    ...GAS_STOCK_DAY,
    metric_id: "gas.gb_nts.linepack.opening",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOB693",
    coverage: "Opening linepack for the gas day, million standard cubic metres. Equals the previous close.",
  },
  "gas.gb_nts.linepack.closing": {
    ...GAS_STOCK_DAY,
    metric_id: "gas.gb_nts.linepack.closing",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOB694",
    coverage: "Closing linepack for the gas day, million standard cubic metres. Equals the next open.",
  },
  "gas.gb_nts.offtake.ldz.volume": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.ldz.volume",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOBJ1015",
    coverage: "LDZ offtake total for the gas day, million standard cubic metres. Parent of the LDZ site rows.",
  },
  "gas.gb_nts.offtake.ldz.energy": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.ldz.energy",
    unit: "kWh",
    sign_convention: "positive_demand",
    dataset_id: "PUBOBJ1023",
    coverage: "LDZ offtake total for the gas day, kWh. Parent of the LDZ site rows.",
  },
  "gas.gb_nts.offtake.power.volume": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.power.volume",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOBJ1017",
    coverage: "Power station offtake total for the gas day, million standard cubic metres.",
  },
  "gas.gb_nts.offtake.power.energy": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.power.energy",
    unit: "kWh",
    sign_convention: "positive_demand",
    dataset_id: "PUBOBJ1025",
    coverage: "Power station offtake total for the gas day, kWh.",
  },
  "gas.gb_nts.offtake.storage_injection.volume": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.storage_injection.volume",
    unit: "mscm",
    sign_convention: "positive_storage_charging",
    dataset_id: "PUBOBJ1016",
    coverage: "Storage injection offtake total for the gas day, million standard cubic metres.",
  },
  "gas.gb_nts.offtake.storage_injection.energy": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.storage_injection.energy",
    unit: "kWh",
    sign_convention: "positive_storage_charging",
    dataset_id: "PUBOBJ1024",
    coverage: "Storage injection offtake total for the gas day, kWh.",
  },
  "gas.gb_nts.offtake.industrial.volume": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.industrial.volume",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOBJ1018",
    coverage: "Industrial offtake total for the gas day, million standard cubic metres.",
  },
  "gas.gb_nts.offtake.interconnector.volume": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.offtake.interconnector.volume",
    unit: "mscm",
    sign_convention: "positive_demand",
    dataset_id: "PUBOBJ1020",
    coverage: "Interconnector export total for the gas day, million standard cubic metres.",
  },
  "gas.gb_nts.supply.storage_withdrawal": {
    ...GAS_DAY_TOTAL,
    metric_id: "gas.gb_nts.supply.storage_withdrawal",
    unit: "mscm",
    sign_convention: "positive_generation",
    dataset_id: "PUBOBJ630",
    coverage: "Storage withdrawal onto the NTS for the gas day, million standard cubic metres, published on D+1.",
  },
} satisfies Record<string, MetricDefinition>;

export type GasMetricId = keyof typeof GAS_METRICS;

export type ConstraintMetricDefinition = MetricDefinition & {
  kind: SeriesKind;
};

const CONSTRAINT_DAY = {
  metric_definition_version: 1,
  geography_id: "GB",
  interval_convention: "uk_settlement_period_half_open",
  denominator: null,
  source_id: "neso-open-data",
  quantity_kind: "interval_total",
  aggregation: "sum",
  expected_cadence: "P1D",
  publication_lag: "P7D",
  stale_grace: "P14D",
} as const;

const CONSTRAINT_SNAPSHOT = {
  metric_definition_version: 1,
  geography_id: "GB",
  interval_convention: "uk_settlement_period_half_open",
  denominator: null,
  source_id: "neso-open-data",
  dataset_id: "day-ahead-constraint-flows-and-limits",
  quantity_kind: "instantaneous_rate",
  aggregation: "last",
  expected_cadence: "P1D",
  publication_lag: "PT0S",
  stale_grace: "P3D",
  kind: "forecast",
} as const;

/**
 * NESO constraint series. Kept out of `METRICS` so the homepage registry stays
 * on the series already shown. `/data-health` appends them from the Blob release.
 * `kind` is measured for the post-event breakdown and forecast for the day-ahead snapshot.
 */
export const CONSTRAINT_METRICS = {
  "elec.gb.constraints.cost.reducing_largest_loss": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.cost.reducing_largest_loss",
    unit: "£",
    sign_convention: "positive_price",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published cost of actions tagged reducing largest loss, on the NESO settlement date, £.",
  },
  "elec.gb.constraints.cost.increasing_system_inertia": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.cost.increasing_system_inertia",
    unit: "£",
    sign_convention: "positive_price",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published cost of actions tagged increasing system inertia, on the NESO settlement date, £.",
  },
  "elec.gb.constraints.cost.voltage": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.cost.voltage",
    unit: "£",
    sign_convention: "positive_price",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published cost of voltage constraint actions, on the NESO settlement date, £.",
  },
  "elec.gb.constraints.cost.thermal": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.cost.thermal",
    unit: "£",
    sign_convention: "positive_price",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published cost of thermal constraint actions, on the NESO settlement date, £.",
  },
  "elec.gb.constraints.volume.reducing_largest_loss": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.volume.reducing_largest_loss",
    unit: "MWh",
    sign_convention: "positive_generation",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published energy volume of actions tagged reducing largest loss, MWh. The sign is the one NESO publishes.",
  },
  "elec.gb.constraints.volume.increasing_system_inertia": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.volume.increasing_system_inertia",
    unit: "MWh",
    sign_convention: "positive_generation",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published energy volume of actions tagged increasing system inertia, MWh. The sign is the one NESO publishes.",
  },
  "elec.gb.constraints.volume.voltage": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.volume.voltage",
    unit: "MWh",
    sign_convention: "positive_generation",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published energy volume of voltage constraint actions, MWh. The sign is the one NESO publishes.",
  },
  "elec.gb.constraints.volume.thermal": {
    ...CONSTRAINT_DAY,
    metric_id: "elec.gb.constraints.volume.thermal",
    unit: "MWh",
    sign_convention: "positive_generation",
    dataset_id: "constraint-breakdown",
    kind: "measured",
    coverage: "Published energy volume of thermal constraint actions, MWh. Negative is the sign NESO publishes for turn-down.",
  },
  "elec.gb.constraints.day_ahead.flow": {
    ...CONSTRAINT_SNAPSHOT,
    metric_id: "elec.gb.constraints.day_ahead.flow",
    unit: "MW",
    sign_convention: "positive_generation",
    coverage:
      "Day-ahead boundary flow, MW, in the direction NESO draws for that constraint group. Not a national sum. The health figure is the newest half-hour.",
  },
  "elec.gb.constraints.day_ahead.limit": {
    ...CONSTRAINT_SNAPSHOT,
    metric_id: "elec.gb.constraints.day_ahead.limit",
    unit: "MW",
    sign_convention: "positive_generation",
    coverage: "Day-ahead boundary limit, MW. Not a national sum. The health figure is the newest half-hour.",
  },
} satisfies Record<string, ConstraintMetricDefinition>;

export type ConstraintMetricId = keyof typeof CONSTRAINT_METRICS;

const WHOLE_ENERGY_YEAR = {
  metric_definition_version: 1,
  geography_id: "UK",
  interval_convention: "calendar_year_half_open",
  denominator: null,
  source_id: "desnz-dukes",
  dataset_id: "dukes-1.1",
  quantity_kind: "interval_total",
  aggregation: "sum",
  expected_cadence: "P1Y",
  publication_lag: "P7M",
  stale_grace: "P1Y",
} as const;

/**
 * DUKES table 1.1, UK annual energy balance. Kept out of `METRICS` so
 * `/data-health` does not treat a yearly statistic as a missing half-hour.
 */
export const WHOLE_ENERGY_METRICS = {
  "energy.uk.primary_supply.total": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.primary_supply.total",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Primary energy supply, TWh, the DUKES table 1.1 total for the calendar year. UK.",
  },
  "energy.uk.primary_supply.natural_gas": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.primary_supply.natural_gas",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Natural gas in primary energy supply, TWh, for the calendar year. UK. Not the gas used later in power generation.",
  },
  "energy.uk.statistical_difference.total": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.statistical_difference.total",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Statistical difference, primary supply minus primary demand, TWh. The sign is the one DUKES publishes. Kept as its own row.",
  },
  "energy.uk.primary_demand.total": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.primary_demand.total",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Primary demand, TWh, the DUKES table 1.1 total for the calendar year. UK.",
  },
  "energy.uk.transformation.natural_gas": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.transformation.natural_gas",
    unit: "TWh",
    sign_convention: "negative_transformation_input",
    coverage:
      "Natural gas input to electricity generation, TWh. A negative value is energy consumed by the transformation, the sign DUKES publishes. Already inside primary supply.",
  },
  "energy.uk.final_consumption.total": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.final_consumption.total",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Final consumption, TWh, the DUKES table 1.1 total for the calendar year. UK.",
  },
  "energy.uk.final_consumption.electricity": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.final_consumption.electricity",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Electricity in final consumption, TWh, every source. Not the output of the gas used for power generation.",
  },
  "energy.uk.final_consumption.domestic": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.final_consumption.domestic",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Domestic final consumption, TWh. Included in Other, so it is not added to the Other row.",
  },
  "energy.uk.final_consumption.transport": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.final_consumption.transport",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Transport final consumption, TWh, for the calendar year. UK.",
  },
  "energy.uk.final_consumption.industry": {
    ...WHOLE_ENERGY_YEAR,
    metric_id: "energy.uk.final_consumption.industry",
    unit: "TWh",
    sign_convention: "positive_demand",
    coverage: "Industry final consumption, TWh, for the calendar year. UK.",
  },
} satisfies Record<string, MetricDefinition>;

export type WholeEnergyMetricId = keyof typeof WHOLE_ENERGY_METRICS;

function eirgridMetric(series: EirgridSeriesSpec): MetricDefinition {
  return {
    metric_definition_version: 1,
    metric_id: series.metric_id,
    unit: series.unit,
    quantity_kind: series.quantity_kind,
    geography_id: series.geography_id,
    interval_convention: series.interval_convention,
    sign_convention: series.sign_convention,
    aggregation: series.aggregation,
    denominator: series.denominator,
    source_id: "eirgrid-group",
    dataset_id: series.area,
    coverage: series.coverage,
    expected_cadence: series.expected_cadence,
    publication_lag: "PT0S",
    stale_grace: "PT1H",
  };
}

/**
 * EirGrid Group series. Kept out of `METRICS` so the homepage registry stays
 * on Great Britain. `/data-health` appends them from the Blob release.
 * Northern Ireland, Ireland, and all-island stay on separate metric ids.
 */
export const EIRGRID_METRICS = Object.fromEntries(
  EIRGRID_SERIES.map((series) => [series.metric_id, eirgridMetric(series)]),
) as { [K in EirgridSeriesSpec["metric_id"]]: MetricDefinition };

export type EirgridMetricId = keyof typeof EIRGRID_METRICS;

export function metricGeographyId(metricId: string): string | null {
  if (Object.prototype.hasOwnProperty.call(METRICS, metricId)) {
    return METRICS[metricId as MetricId].geography_id;
  }
  if (Object.prototype.hasOwnProperty.call(GAS_METRICS, metricId)) {
    return GAS_METRICS[metricId as GasMetricId].geography_id;
  }
  if (Object.prototype.hasOwnProperty.call(CONSTRAINT_METRICS, metricId)) {
    return CONSTRAINT_METRICS[metricId as ConstraintMetricId].geography_id;
  }
  if (Object.prototype.hasOwnProperty.call(EIRGRID_METRICS, metricId)) {
    return EIRGRID_METRICS[metricId as EirgridMetricId].geography_id;
  }
  if (Object.prototype.hasOwnProperty.call(WHOLE_ENERGY_METRICS, metricId)) {
    return WHOLE_ENERGY_METRICS[metricId as WholeEnergyMetricId].geography_id;
  }
  return null;
}

const GB_DATA_HEALTH_GEOGRAPHIES = new Set(["GB", "GB_NTS"]);

/** GB electricity and GB gas. NI, Ireland, UK annual, and other commodities stay out. */
export function isGbDataHealthMetric(metricId: string): boolean {
  const geography = metricGeographyId(metricId);
  return geography != null && GB_DATA_HEALTH_GEOGRAPHIES.has(geography);
}

export function gbDataHealthReading<T extends { metric_id: string }>(reading: T): (T & { geography_id: string }) | null {
  const geography_id = metricGeographyId(reading.metric_id);
  if (!geography_id || !isGbDataHealthMetric(reading.metric_id)) {
    return null;
  }
  return { ...reading, geography_id };
}

/** Physical NTS series shown on /gas. Separate from the SAP price card. */
export function physicalGasCoverage(): readonly {
  dataset_id: string;
  expected_cadence: string;
  coverage: string;
}[] {
  return Object.values(GAS_METRICS).map((metric) => ({
    dataset_id: metric.dataset_id,
    expected_cadence: metric.expected_cadence,
    coverage: metric.coverage,
  }));
}

/** Duration the stale clock waits. The public lag stays `publication_lag`. */
export function staleGrace(metric: Pick<MetricDefinition, "publication_lag" | "stale_grace">): string {
  return metric.stale_grace ?? metric.publication_lag;
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
