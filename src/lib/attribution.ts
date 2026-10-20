export const ELEXON_BMRS_LICENCE_URL =
  "https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/";

export const ELEXON_ISD_URL = "https://www.elexon.co.uk/bsc/data/industry-standing-data/";

export const ELEXON_ISD_API_URL = "https://datastore.helix.elexon.co.uk/api/ISD";

export const ELEXON_BSC_OPEN_DATA_LICENCE_URL =
  "https://www.elexon.co.uk/bsc/data/open-data-requests/bsc-open-data-licence/";

/**
 * The ISD Data Store is publicly available. The BSC Open Data Licence covers
 * only information Elexon identifies as open data, and the ISD page does not
 * make that identification. Display of lookup fields stays. Redistribution of
 * an extract stays source-blocked.
 */
export const ELEXON_ISD_ATTRIBUTION =
  "Industry Standing Data from the Elexon ISD Data Store. The store is publicly available. Grid shows the fields needed to look up a code. Elexon has not identified ISD under the BSC Open Data Licence, so Grid does not offer a download of the extract.";

export const ELEXON_BMRS_ATTRIBUTION_PREFIX =
  "Contains BMRS data © Elexon Limited copyright and database right";

export const NESO_OPEN_DATA_LICENCE_URL =
  "https://www.neso.energy/data-portal/neso-open-data-licence";

export const NESO_OPEN_DATA_ATTRIBUTION = "Supported by National Energy SO Open Data";

export const NESO_HISTORIC_MIX_URL =
  "https://www.neso.energy/data-portal/historic-generation-mix";

export const NESO_EMBEDDED_FORECAST_URL =
  "https://www.neso.energy/data-portal/embedded-wind-and-solar-forecasts";

export const NESO_CONSTRAINT_BREAKDOWN_URL =
  "https://www.neso.energy/data-portal/constraint-breakdown";

export const NESO_DAY_AHEAD_CONSTRAINTS_URL =
  "https://www.neso.energy/data-portal/day-ahead-constraint-flows-and-limits";

export const NESO_TEC_REGISTER_URL =
  "https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register";

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

export const EIRGRID_GROUP_LICENCE_URL = "https://www.smartgriddashboard.com/all/open-data-license/";

/** Read on 15 Oct 2026. The licence says EirGrid Group may revise it without notice. */
export const EIRGRID_GROUP_LICENCE_READ_ON = "2026-10-15";

export const EIRGRID_GROUP_ATTRIBUTION = "Supported by EirGrid Group Data";

export const SONI_SOURCE_LINE = "Source: SONI.";

export const SEMO_SOURCE_LINE = "Source: SEMO.";

export const NI_FLOW_NOTE = "Flows to and from Northern Ireland. NI figures are on a separate page.";

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
  "neso-dno-areas",
  "os-open-zoomstack",
  "eirgrid-group",
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
