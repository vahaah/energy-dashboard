export const ELEXON_BMRS_LICENCE_URL =
  "https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/";

export const ELEXON_BMRS_ATTRIBUTION_PREFIX =
  "Contains BMRS data © Elexon Limited copyright and database right";

export const NESO_OPEN_DATA_LICENCE_URL =
  "https://www.neso.energy/data-portal/neso-open-data-licence";

export const NESO_OPEN_DATA_ATTRIBUTION = "Supported by National Energy SO Open Data";

export const NESO_HISTORIC_MIX_URL =
  "https://www.neso.energy/data-portal/historic-generation-mix";

export const CARBON_INTENSITY_API_URL = "https://carbonintensity.org.uk/";

export const CARBON_INTENSITY_ATTRIBUTION =
  "National carbon intensity from the NESO Carbon Intensity API (CC BY 4.0).";

export const CARBON_INTENSITY_FORECAST_NOTE =
  "Grid shows a derived cleanest-window answer from the 48-hour forecast. The raw forecast series is not republished.";

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
