export const ELEXON_BMRS_LICENCE_URL =
  "https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/";

export const ELEXON_BMRS_ATTRIBUTION_PREFIX =
  "Contains BMRS data © Elexon Limited copyright and database right";

export const NESO_OPEN_DATA_LICENCE_URL =
  "https://www.neso.energy/data-portal/neso-open-data-licence";

export const NESO_OPEN_DATA_ATTRIBUTION = "Supported by National Energy SO Open Data";

export const NESO_HISTORIC_MIX_URL =
  "https://www.neso.energy/data-portal/historic-generation-mix";

export const NESO_EMBEDDED_FORECAST_URL =
  "https://www.neso.energy/data-portal/embedded-wind-and-solar-forecasts";

export const NESO_EMBEDDED_FORECAST_RESOURCE_ID = "db6c038f-98af-4570-ab60-24d71ebd0ae5";

export const CARBON_INTENSITY_API_URL = "https://carbonintensity.org.uk/";

export const CC_BY_4_0_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export const CARBON_INTENSITY_LICENCE_URL = CC_BY_4_0_LICENSE_URL;

export const CARBON_INTENSITY_ATTRIBUTION =
  "National carbon intensity from the NESO Carbon Intensity API (CC BY 4.0). Developed by NESO with the University of Oxford, Environmental Defense Fund Europe and WWF.";

export const CARBON_INTENSITY_FORECAST_NOTE =
  "Grid shows a derived cleanest-window answer from the 48-hour forecast. The raw forecast series is not republished.";

export const PV_LIVE_URL = "https://www.solar.sheffield.ac.uk/pvlive/";

export const PV_LIVE_ATTRIBUTION =
  "GB solar estimates from Sheffield Solar PV_Live, University of Sheffield, developed with NESO.";

export const PV_LIVE_LICENCE =
  "Open access. UKERC records that PV Live data may be freely used for any purpose.";

export const EIA_URL = "https://www.eia.gov/";

export const EIA_ATTRIBUTION = "Source: U.S. Energy Information Administration.";

export const EIA_LICENCE = "U.S. government work. Public domain; attribution requested.";

export const WORLD_BANK_PINK_SHEET_URL =
  "https://www.worldbank.org/en/research/commodity-markets";

export const WORLD_BANK_PINK_SHEET_LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";

export const WORLD_BANK_PINK_SHEET_ATTRIBUTION =
  "Source: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0.";

export const NATIONAL_GAS_PORTAL_URL = "https://data.nationalgas.com";

export const NATIONAL_GAS_ATTRIBUTION =
  "Contains National Gas Transmission operational data from the Gas Data Portal (PUBOB603, System Average Price).";

export const NATIONAL_GAS_LICENCE =
  "Published as open operational data under the National Gas System Operator licence.";

export const DATA_SOURCE_IDS = [
  "elexon-bmrs",
  "neso-open-data",
  "carbon-intensity",
  "sheffield-pv-live",
  "eia",
  "world-bank-pink-sheet",
  "national-gas",
] as const;

export type DataSourceId = (typeof DATA_SOURCE_IDS)[number];

export type DataSourceRecord = {
  id: DataSourceId;
  name: string;
  usedFor: string;
  url: string;
  licence: string;
  licenceUrl: string | null;
  attribution: string;
};

export function elexonBmrsAttribution(year = new Date().getUTCFullYear()): string {
  return `${ELEXON_BMRS_ATTRIBUTION_PREFIX} ${year}.`;
}

export function elexonBmrsAttributionBlock(year = new Date().getUTCFullYear()): {
  text: string;
  licence: string;
} {
  return {
    text: elexonBmrsAttribution(year),
    licence: ELEXON_BMRS_LICENCE_URL,
  };
}

export function dataSources(year = new Date().getUTCFullYear()): DataSourceRecord[] {
  return [
    {
      id: "elexon-bmrs",
      name: "Elexon BMRS / Insights",
      usedFor:
        "Market Index (APXMIDP), system (imbalance) price, ITSDO demand, FUELINST generation and interconnectors, WINDFOR, and NDF.",
      url: "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
      licence: "Elexon BMRS Data Licence",
      licenceUrl: ELEXON_BMRS_LICENCE_URL,
      attribution: elexonBmrsAttribution(year),
    },
    {
      id: "neso-open-data",
      name: "NESO Data Portal",
      usedFor:
        "Embedded wind, embedded wind and solar forecasts, and historic generation mix used for Year, All time, and records.",
      url: "https://www.neso.energy/data-portal",
      licence: "NESO Open Data Licence",
      licenceUrl: NESO_OPEN_DATA_LICENCE_URL,
      attribution: NESO_OPEN_DATA_ATTRIBUTION,
    },
    {
      id: "carbon-intensity",
      name: "Carbon Intensity API",
      usedFor: "National carbon intensity (actual half-hours) and a derived cleanest-window look-ahead.",
      url: CARBON_INTENSITY_API_URL,
      licence: "CC BY 4.0",
      licenceUrl: CARBON_INTENSITY_LICENCE_URL,
      attribution: CARBON_INTENSITY_ATTRIBUTION,
    },
    {
      id: "sheffield-pv-live",
      name: "Sheffield Solar PV_Live",
      usedFor: "National GB solar including estimated embedded / rooftop generation.",
      url: PV_LIVE_URL,
      licence: PV_LIVE_LICENCE,
      licenceUrl: PV_LIVE_URL,
      attribution: PV_LIVE_ATTRIBUTION,
    },
    {
      id: "eia",
      name: "U.S. Energy Information Administration",
      usedFor: "Daily Brent, WTI, and Henry Hub prices.",
      url: EIA_URL,
      licence: EIA_LICENCE,
      licenceUrl: EIA_URL,
      attribution: EIA_ATTRIBUTION,
    },
    {
      id: "world-bank-pink-sheet",
      name: "World Bank Pink Sheet",
      usedFor: "Monthly Europe natural gas and Japan LNG prices.",
      url: WORLD_BANK_PINK_SHEET_URL,
      licence: "CC BY 4.0",
      licenceUrl: WORLD_BANK_PINK_SHEET_LICENCE_URL,
      attribution: WORLD_BANK_PINK_SHEET_ATTRIBUTION,
    },
    {
      id: "national-gas",
      name: "National Gas",
      usedFor: "Great Britain System Average Price (PUBOB603) in p/kWh.",
      url: NATIONAL_GAS_PORTAL_URL,
      licence: NATIONAL_GAS_LICENCE,
      licenceUrl: NATIONAL_GAS_PORTAL_URL,
      attribution: NATIONAL_GAS_ATTRIBUTION,
    },
  ];
}

export function captionElexon(year = new Date().getUTCFullYear()): string {
  return elexonBmrsAttribution(year);
}

export function captionNeso(): string {
  return `${NESO_OPEN_DATA_ATTRIBUTION}.`;
}

export function captionCarbon(neso = false): string {
  return neso ? `${NESO_OPEN_DATA_ATTRIBUTION}.` : CARBON_INTENSITY_ATTRIBUTION;
}

export function captionGeneration(neso = false, year = new Date().getUTCFullYear()): string {
  return neso
    ? `${NESO_OPEN_DATA_ATTRIBUTION}.`
    : `${elexonBmrsAttribution(year)} ${NESO_OPEN_DATA_ATTRIBUTION}. ${PV_LIVE_ATTRIBUTION}`;
}

export function captionTransfers(neso: boolean, year = new Date().getUTCFullYear()): string {
  return neso ? `${NESO_OPEN_DATA_ATTRIBUTION}.` : elexonBmrsAttribution(year);
}

export function captionCommodities(): string {
  return `${EIA_ATTRIBUTION} ${WORLD_BANK_PINK_SHEET_ATTRIBUTION} ${NATIONAL_GAS_ATTRIBUTION}`;
}
