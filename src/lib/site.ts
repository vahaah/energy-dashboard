import { formatGrouped } from "@/lib/format/quantity";

export const SITE_ORIGIN = "https://grid.vahaah.com";
export const SITE_URL = SITE_ORIGIN;
export const SITE_NAME = "Grid";

export const HOME_TITLE = "What's powering Britain's electricity today? | Grid";
export const HOME_DESCRIPTION =
  "GB electricity mix, carbon intensity, demand and prices. Free and updated hourly from Elexon, NESO and Sheffield Solar, with a source on each figure.";

export const RECORDS_TITLE = "GB electricity records: wind, carbon, renewables | Grid";
export const RECORDS_DESCRIPTION =
  "Britain's highest wind, highest renewable share and lowest carbon half-hours since Grid's records began, each shown next to NESO's official record.";

export const TODAY_TITLE = "GB electricity today: mix, carbon and price | Grid";
export const TODAY_DESCRIPTION =
  "How Britain's electricity was made today: wind, gas, nuclear, solar and imports in GW and %, plus carbon intensity and market price. Free, updated hourly.";
export const TODAY_H1 = "GB electricity today";

export const PRICE_CAP_TITLE = "Will energy bills go up in January 2027? | Grid";
export const PRICE_CAP_DESCRIPTION =
  "Ofgem announces the January–March 2027 price cap on 25 November 2026. The cap is £1,723 a year now. What sets it, what gas has done, what it covers.";
export const PRICE_CAP_H1 = "Will energy bills go up in January 2027?";

export const GAS_TITLE = "GB gas price today: SAP, Henry Hub and LNG | Grid";
export const GAS_DESCRIPTION =
  "Today's GB System Average Price of gas in p/therm and p/kWh from National Gas, with Henry Hub, European gas and Japan LNG for context. Free, with sources.";
export const GAS_H1 = "GB gas price today";

export const DATA_HEALTH_TITLE = "Data health: freshness of every series | Grid";
export const DATA_HEALTH_DESCRIPTION =
  "When each source last published and when Grid fetched it, for every GB electricity, gas and price series, checked against its expected cadence.";
export const DATA_HEALTH_H1 = "Data health";

export const METHODOLOGY_TITLE = "Methodology: sources, checks and records | Grid";
export const METHODOLOGY_DESCRIPTION =
  "How Grid compiles GB electricity and gas figures: every source, licence, refresh cadence, definition and data check, and how records are compared.";
export const METHODOLOGY_H1 = "How Grid's numbers are made";

export const MAP_TITLE = "Map of GB electricity and gas flows | Grid";
export const MAP_DESCRIPTION =
  "Map of Britain's electricity interconnectors and gas entry points with the latest published flows in MW and mcm/d, plus power stations and DNO areas.";
export const ASSETS_TITLE = "GB power stations: capacity, technology, region | Grid";
export const ASSETS_DESCRIPTION =
  "Search operational power stations, interconnectors and gas terminals in Great Britain by technology, region and capacity, from DESNZ REPD and DUKES.";

export function assetsDirectoryDescription(count: number): string {
  return `Search ${formatGrouped(count, 0)} operational power stations, interconnectors and gas terminals in Great Britain by technology, region and capacity, from DESNZ REPD and DUKES.`;
}

export const API_DOCS_TITLE = "Free GB electricity and gas data API (JSON) | Grid";
export const API_DOCS_DESCRIPTION =
  "Free JSON API for GB electricity and gas data: no key, 60 requests a minute. Gas flows, projects, constraints, code lookups, changes and data health.";
export const API_DOCS_H1 = "What data can I get from Grid, and how?";

export const HOME_H1 = "What's powering Britain?";
export const RECORDS_H1 = "GB electricity records";
export const RECORDS_SUBLINE =
  "Highest and lowest half-hours since Grid's records began (NESO historic data from 2009), shown next to NESO's official records.";

export const DATASET_TEMPORAL_COVERAGE_START = "2025-03-18";

export const SITE_TITLE = HOME_TITLE;
export const SITE_DESCRIPTION = HOME_DESCRIPTION;

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";
export const OG_HOURLY_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
export const OG_SETTLEMENT_CACHE_CONTROL = "public, s-maxage=1800, stale-while-revalidate=86400";
export const OG_REVALIDATE_SECONDS = 86_400;

export const SITE_OG_IMAGE = {
  url: "/og",
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
  alt: HOME_TITLE,
};

export const SITE_TWITTER_CARD = {
  card: "summary_large_image" as const,
  images: ["/og"],
};

export const SITE_OG_TYPE = "website" as const;

export const TITLE_MAX_CHARS = 60;
export const DESCRIPTION_MIN_CHARS = 120;
export const DESCRIPTION_MAX_CHARS = 155;

export function pageTitleLength(title: string): number {
  return [...title].length;
}

export function pageDescriptionLength(description: string): number {
  return [...description].length;
}

export const LEGAL_CONTROLLER = "Comonad Ltd";
export const LEGAL_CONTACT_EMAIL = "alex@comonad.co.uk";
export const LEGAL_CONTACT_MAILTO = `mailto:${LEGAL_CONTACT_EMAIL}`;
export const LEGAL_JURISDICTION = "England and Wales";
export const CODE_LICENCE = "MIT";
export const CODE_LICENCE_URL = "https://opensource.org/licenses/MIT";
