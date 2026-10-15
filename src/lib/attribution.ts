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
  "Data sourced from the National Gas Transmission Data Portal.";

export const NATIONAL_GAS_LICENCE =
  "National Gas Transmission confirmed in writing on 14 Oct 2026 that Grid may reuse Gas Data Portal and API data. Published as open operational data under the National Gas System Operator licence.";

export const OGL_V3_LICENCE_URL =
  "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

export const OGL_V3_ATTRIBUTION =
  "Contains public sector information licensed under the Open Government Licence v3.0.";

export const DATA_SOURCE_IDS = [
  "elexon-bmrs",
  "neso-open-data",
  "carbon-intensity",
  "sheffield-pv-live",
  "eia",
  "world-bank-pink-sheet",
  "national-gas",
  "desnz-repd",
  "desnz-dukes",
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
