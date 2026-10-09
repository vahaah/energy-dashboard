export const ELEXON_BMRS_LICENCE_URL =
  "https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/";

export const ELEXON_BMRS_ATTRIBUTION_PREFIX =
  "Contains BMRS data © Elexon Limited copyright and database right";

export const NESO_OPEN_DATA_LICENCE_URL =
  "https://www.neso.energy/data-portal/neso-open-data-licence";

export const NESO_OPEN_DATA_ATTRIBUTION = "Supported by National Energy SO Open Data";

export const NESO_HISTORIC_MIX_URL =
  "https://www.neso.energy/data-portal/historic-generation-mix";

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
