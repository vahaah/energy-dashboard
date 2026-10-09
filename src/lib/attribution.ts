export const ELEXON_BMRS_LICENCE_URL =
  "https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/";

export const ELEXON_BMRS_ATTRIBUTION_PREFIX =
  "Contains BMRS data © Elexon Limited copyright and database right";

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
