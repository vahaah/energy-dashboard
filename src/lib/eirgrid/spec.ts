import type { QuantityKind, SignConvention } from "@/lib/types";
import { SEMO_SOURCE_LINE, SONI_SOURCE_LINE } from "@/lib/attribution";

export const EIRGRID_GEOGRAPHIES = ["GB", "NI", "IE", "ALL_ISLAND"] as const;

export type EirgridGeography = (typeof EIRGRID_GEOGRAPHIES)[number];

export const EIRGRID_SOURCE_LINES = [SONI_SOURCE_LINE, SEMO_SOURCE_LINE] as const;

export type EirgridSourceLine = (typeof EIRGRID_SOURCE_LINES)[number];

export type EirgridSeriesSpec = {
  metric_id: string;
  geography_id: Exclude<EirgridGeography, "GB">;
  field: string;
  /** Feed area. The catalogue key. */
  area: string;
  unit: string;
  quantity_kind: QuantityKind;
  sign_convention: SignConvention;
  interval_convention: "quarter_hour_half_open" | "half_hour_half_open";
  expected_cadence: "PT15M" | "PT30M";
  aggregation: "mean" | "last";
  denominator: string | null;
  source_line: EirgridSourceLine;
  label: string;
  coverage: string;
};

const QUARTER = {
  interval_convention: "quarter_hour_half_open",
  expected_cadence: "PT15M",
  aggregation: "mean",
  denominator: null,
  source_line: SONI_SOURCE_LINE,
} as const;

const HALF = {
  interval_convention: "half_hour_half_open",
  expected_cadence: "PT30M",
  aggregation: "mean",
  denominator: null,
} as const;

function power(
  metric_id: string,
  geography_id: EirgridSeriesSpec["geography_id"],
  field: string,
  area: string,
  label: string,
  coverage: string,
  sign_convention: SignConvention = "positive_generation",
): EirgridSeriesSpec {
  return {
    metric_id,
    geography_id,
    field,
    area,
    unit: "MW",
    quantity_kind: "instantaneous_rate",
    sign_convention,
    label,
    coverage,
    ...QUARTER,
  };
}

function demand(
  metric_id: string,
  geography_id: EirgridSeriesSpec["geography_id"],
  label: string,
  coverage: string,
): EirgridSeriesSpec {
  return power(metric_id, geography_id, "SYSTEM_DEMAND", "demandactual", label, coverage, "positive_demand");
}

/**
 * Series the Smart Grid Dashboard actually returned on 15 Oct 2026.
 * Northern Ireland, Ireland (ROI), and all-island stay on separate metric ids.
 * GB and UK are not in this list.
 */
export const EIRGRID_SERIES: readonly EirgridSeriesSpec[] = [
  demand(
    "elec.ni.demand.system",
    "NI",
    "NI system demand",
    "SONI system demand, MW, 15-minute. Northern Ireland. Grid's GB demand is a different series.",
  ),
  demand(
    "elec.ie.demand.system",
    "IE",
    "Ireland system demand",
    "EirGrid system demand, MW, 15-minute. Ireland (ROI on the feed). Not Northern Ireland and not GB.",
  ),
  demand(
    "elec.all_island.demand.system",
    "ALL_ISLAND",
    "All-island system demand",
    "All-island system demand, MW, 15-minute, the feed's ALL region. Not a sum of GB and Northern Ireland.",
  ),
  power(
    "elec.ni.generation.system",
    "NI",
    "GEN_EXP",
    "generationactual",
    "NI system generation",
    "SONI system generation, MW, 15-minute. Northern Ireland.",
  ),
  power(
    "elec.ie.generation.system",
    "IE",
    "GEN_EXP",
    "generationactual",
    "Ireland system generation",
    "EirGrid system generation, MW, 15-minute. Ireland.",
  ),
  power(
    "elec.all_island.generation.system",
    "ALL_ISLAND",
    "GEN_EXP",
    "generationactual",
    "All-island system generation",
    "All-island system generation, MW, 15-minute, the feed's ALL region.",
  ),
  power("elec.ni.generation.wind", "NI", "WIND_ACTUAL", "windactual", "NI wind", "SONI wind generation, MW, 15-minute. Northern Ireland."),
  power("elec.ie.generation.wind", "IE", "WIND_ACTUAL", "windactual", "Ireland wind", "EirGrid wind generation, MW, 15-minute. Ireland."),
  power(
    "elec.all_island.generation.wind",
    "ALL_ISLAND",
    "WIND_ACTUAL",
    "windactual",
    "All-island wind",
    "All-island wind generation, MW, 15-minute, the feed's ALL region.",
  ),
  power(
    "elec.ni.generation.wind_forecast",
    "NI",
    "WIND_FCAST",
    "windforecast",
    "NI wind forecast",
    "SONI wind forecast, MW, 15-minute. Northern Ireland.",
  ),
  power(
    "elec.ie.generation.wind_forecast",
    "IE",
    "WIND_FCAST",
    "windforecast",
    "Ireland wind forecast",
    "EirGrid wind forecast, MW, 15-minute. Ireland.",
  ),
  power(
    "elec.all_island.generation.wind_forecast",
    "ALL_ISLAND",
    "WIND_FCAST",
    "windforecast",
    "All-island wind forecast",
    "All-island wind forecast, MW, 15-minute, the feed's ALL region.",
  ),
  power("elec.ni.generation.solar", "NI", "SOLAR_ACTUAL", "solaractual", "NI solar", "SONI solar generation, MW, 15-minute. Northern Ireland."),
  power("elec.ie.generation.solar", "IE", "SOLAR_ACTUAL", "solaractual", "Ireland solar", "EirGrid solar generation, MW, 15-minute. Ireland."),
  power(
    "elec.all_island.generation.solar",
    "ALL_ISLAND",
    "SOLAR_ACTUAL",
    "solaractual",
    "All-island solar",
    "All-island solar generation, MW, 15-minute, the feed's ALL region.",
  ),
  power(
    "elec.ni.generation.solar_forecast",
    "NI",
    "SOLAR_FCAST",
    "solarforecast",
    "NI solar forecast",
    "SONI solar forecast, MW, 15-minute. Northern Ireland.",
  ),
  power(
    "elec.ie.generation.solar_forecast",
    "IE",
    "SOLAR_FCAST",
    "solarforecast",
    "Ireland solar forecast",
    "EirGrid solar forecast, MW, 15-minute. Ireland.",
  ),
  power(
    "elec.all_island.generation.solar_forecast",
    "ALL_ISLAND",
    "SOLAR_FCAST",
    "solarforecast",
    "All-island solar forecast",
    "All-island solar forecast, MW, 15-minute, the feed's ALL region.",
  ),
  {
    ...QUARTER,
    metric_id: "elec.ni.carbon.intensity",
    geography_id: "NI",
    field: "CO2_INTENSITY",
    area: "co2intensity",
    unit: "gCO₂/kWh",
    quantity_kind: "index",
    sign_convention: "positive_intensity",
    label: "NI carbon intensity",
    coverage: "SONI carbon intensity, gCO₂/kWh, 15-minute. Northern Ireland.",
  },
  {
    ...QUARTER,
    metric_id: "elec.ie.carbon.intensity",
    geography_id: "IE",
    field: "CO2_INTENSITY",
    area: "co2intensity",
    unit: "gCO₂/kWh",
    quantity_kind: "index",
    sign_convention: "positive_intensity",
    label: "Ireland carbon intensity",
    coverage: "EirGrid carbon intensity, gCO₂/kWh, 15-minute. Ireland.",
  },
  {
    ...QUARTER,
    metric_id: "elec.all_island.carbon.intensity",
    geography_id: "ALL_ISLAND",
    field: "CO2_INTENSITY",
    area: "co2intensity",
    unit: "gCO₂/kWh",
    quantity_kind: "index",
    sign_convention: "positive_intensity",
    label: "All-island carbon intensity",
    coverage: "All-island carbon intensity, gCO₂/kWh, 15-minute, the feed's ALL region.",
  },
  {
    ...QUARTER,
    metric_id: "elec.ni.transfers.moyle",
    geography_id: "NI",
    field: "INTER_MOYLE",
    area: "interconnection",
    unit: "MW",
    quantity_kind: "instantaneous_rate",
    sign_convention: "signed_as_published",
    label: "Moyle",
    coverage: "Moyle flow, MW, 15-minute, the sign SONI publishes. Northern Ireland. Not added to a GB interconnector total.",
  },
  {
    ...QUARTER,
    metric_id: "elec.ni.transfers.net",
    geography_id: "NI",
    field: "INTER_NET_NI",
    area: "interconnection",
    unit: "MW",
    quantity_kind: "instantaneous_rate",
    sign_convention: "signed_as_published",
    label: "NI net transfer",
    coverage: "Northern Ireland net interconnector flow, MW, 15-minute, the sign SONI publishes.",
  },
  {
    ...QUARTER,
    metric_id: "elec.ie.transfers.ewic",
    geography_id: "IE",
    field: "INTER_EWIC",
    area: "interconnection",
    unit: "MW",
    quantity_kind: "instantaneous_rate",
    sign_convention: "signed_as_published",
    label: "EWIC",
    coverage: "EWIC flow, MW, 15-minute, the sign the feed publishes. Ireland.",
  },
  {
    ...QUARTER,
    metric_id: "elec.ie.transfers.greenlink",
    geography_id: "IE",
    field: "INTER_GRNLK",
    area: "interconnection",
    unit: "MW",
    quantity_kind: "instantaneous_rate",
    sign_convention: "signed_as_published",
    label: "Greenlink",
    coverage: "Greenlink flow, MW, 15-minute, the sign the feed publishes. Ireland.",
  },
  {
    ...QUARTER,
    metric_id: "elec.ie.transfers.net",
    geography_id: "IE",
    field: "INTER_NET_ROI",
    area: "interconnection",
    unit: "MW",
    quantity_kind: "instantaneous_rate",
    sign_convention: "signed_as_published",
    label: "Ireland net transfer",
    coverage: "Ireland net interconnector flow, MW, 15-minute, the sign the feed publishes.",
  },
  {
    ...QUARTER,
    metric_id: "elec.all_island.transfers.net",
    geography_id: "ALL_ISLAND",
    field: "INTER_NET",
    area: "interconnection",
    unit: "MW",
    quantity_kind: "instantaneous_rate",
    sign_convention: "signed_as_published",
    label: "All-island net transfer",
    coverage: "All-island net interconnector flow, MW, 15-minute, the feed's ALL region. Not a GB plus NI sum.",
  },
  fuel("elec.ni.fuel.gas", "NI", "FUEL_GAS", "NI gas", "SONI day fuel mix, gas, MWh. Northern Ireland."),
  fuel("elec.ni.fuel.renewables", "NI", "FUEL_RENEW", "NI renewables", "SONI day fuel mix, renewables, MWh. Northern Ireland."),
  fuel("elec.ni.fuel.net_import", "NI", "FUEL_NET_IMPORT", "NI net import", "SONI day fuel mix, net import, MWh. Northern Ireland."),
  fuel("elec.ie.fuel.coal", "IE", "FUEL_COAL", "Ireland coal", "EirGrid day fuel mix, coal, MWh. Ireland."),
  fuel("elec.ie.fuel.gas", "IE", "FUEL_GAS", "Ireland gas", "EirGrid day fuel mix, gas, MWh. Ireland."),
  fuel("elec.ie.fuel.other_fossil", "IE", "FUEL_OTHER_FOSSIL", "Ireland other fossil", "EirGrid day fuel mix, other fossil, MWh. Ireland."),
  fuel("elec.ie.fuel.renewables", "IE", "FUEL_RENEW", "Ireland renewables", "EirGrid day fuel mix, renewables, MWh. Ireland."),
  fuel("elec.ie.fuel.net_import", "IE", "FUEL_NET_IMPORT", "Ireland net import", "EirGrid day fuel mix, net import, MWh. Ireland."),
  fuel("elec.all_island.fuel.coal", "ALL_ISLAND", "FUEL_COAL", "All-island coal", "All-island day fuel mix, coal, MWh, the feed's ALL region."),
  fuel("elec.all_island.fuel.gas", "ALL_ISLAND", "FUEL_GAS", "All-island gas", "All-island day fuel mix, gas, MWh, the feed's ALL region."),
  fuel(
    "elec.all_island.fuel.other_fossil",
    "ALL_ISLAND",
    "FUEL_OTHER_FOSSIL",
    "All-island other fossil",
    "All-island day fuel mix, other fossil, MWh, the feed's ALL region.",
  ),
  fuel(
    "elec.all_island.fuel.renewables",
    "ALL_ISLAND",
    "FUEL_RENEW",
    "All-island renewables",
    "All-island day fuel mix, renewables, MWh, the feed's ALL region.",
  ),
  fuel(
    "elec.all_island.fuel.net_import",
    "ALL_ISLAND",
    "FUEL_NET_IMPORT",
    "All-island net import",
    "All-island day fuel mix, net import, MWh, the feed's ALL region.",
  ),
  {
    ...HALF,
    metric_id: "elec.all_island.snsp.share",
    geography_id: "ALL_ISLAND",
    field: "SNSP_ALL",
    area: "SnspAll",
    unit: "%",
    quantity_kind: "share",
    sign_convention: "share_of_denominator",
    denominator: "all-island system",
    source_line: SONI_SOURCE_LINE,
    label: "All-island SNSP",
    coverage: "System non-synchronous penetration, percent, the feed's all-island series. Not published as a Northern Ireland-only figure.",
  },
  {
    ...HALF,
    metric_id: "elec.all_island.price.imbalance",
    geography_id: "ALL_ISLAND",
    field: "IMBALANCE_SETTLEMENT_PRICE",
    area: "marketPricing",
    unit: "€/MWh",
    quantity_kind: "index",
    sign_convention: "positive_price",
    source_line: SEMO_SOURCE_LINE,
    label: "Imbalance settlement price",
    coverage: "SEMO imbalance settlement price, euro per MWh, as published. No sterling conversion.",
  },
  {
    ...HALF,
    metric_id: "elec.all_island.imbalance.volume",
    geography_id: "ALL_ISLAND",
    field: "NET_IMBALANCE_VOLUME",
    area: "marketPricing",
    unit: "MWh",
    quantity_kind: "interval_total",
    sign_convention: "signed_as_published",
    aggregation: "last",
    source_line: SEMO_SOURCE_LINE,
    label: "Net imbalance volume",
    coverage: "SEMO net imbalance volume, MWh, as published. All-island Single Electricity Market.",
  },
];

function fuel(
  metric_id: string,
  geography_id: EirgridSeriesSpec["geography_id"],
  field: string,
  label: string,
  coverage: string,
): EirgridSeriesSpec {
  return {
    ...QUARTER,
    metric_id,
    geography_id,
    field,
    area: "fuelmix",
    unit: "MWh",
    quantity_kind: "interval_total",
    sign_convention: field === "FUEL_NET_IMPORT" ? "signed_as_published" : "positive_generation",
    aggregation: "last",
    label,
    coverage,
  };
}

export type EirgridMetricId = (typeof EIRGRID_SERIES)[number]["metric_id"];

export function eirgridSeriesByMetric(metricId: string): EirgridSeriesSpec | null {
  return EIRGRID_SERIES.find((series) => series.metric_id === metricId) ?? null;
}

export function eirgridSeriesFor(field: string, geographyId: string): EirgridSeriesSpec | null {
  return EIRGRID_SERIES.find((series) => series.field === field && series.geography_id === geographyId) ?? null;
}

const REGION_TO_GEOGRAPHY: Record<string, EirgridSeriesSpec["geography_id"]> = {
  NI: "NI",
  ROI: "IE",
  ALL: "ALL_ISLAND",
};

export function geographyFromFeedRegion(region: string): EirgridSeriesSpec["geography_id"] | null {
  return REGION_TO_GEOGRAPHY[region] ?? null;
}

export const CHART_AREAS = [
  "demandactual",
  "generationactual",
  "windactual",
  "windforecast",
  "solaractual",
  "solarforecast",
  "co2intensity",
] as const;

export const EIRGRID_CHART_ORIGIN = "https://www.smartgriddashboard.com";
