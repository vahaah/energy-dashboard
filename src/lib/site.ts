export const SITE_ORIGIN = "https://grid.vahaah.com";
export const SITE_URL = SITE_ORIGIN;
export const SITE_NAME = "Grid";

export const HOME_TITLE = "Grid: what's powering Britain's electricity today";
export const HOME_DESCRIPTION =
  "Britain's electricity mix, carbon intensity, demand and prices, updated hourly from Elexon, NESO and Sheffield Solar. Free, with sources on every number.";

export const RECORDS_TITLE = "GB electricity records: wind, solar and carbon";
export const RECORDS_DESCRIPTION =
  "Highest wind and renewable share and lowest carbon since Grid's records began, shown next to NESO's official records. Sourced from NESO data.";

export const TODAY_TITLE = "GB electricity today: mix, carbon and price";
export const TODAY_DESCRIPTION =
  "How Britain's electricity was made today: wind, gas, nuclear, solar and imports in GW and %, carbon intensity and market price. Updated hourly.";
export const TODAY_H1 = "Britain's electricity today";

export const PRICE_CAP_TITLE = "Will energy bills go up in January 2027?";
export const PRICE_CAP_DESCRIPTION =
  "Ofgem announces the January–March 2027 price cap by 25 November 2026. What drives it, what wholesale gas has done, and what Grid's data shows.";
export const PRICE_CAP_H1 = "Will energy bills go up in January 2027?";

export const GAS_TITLE = "UK gas price today: SAP, Henry Hub, Europe, Japan LNG";
export const GAS_DESCRIPTION =
  "GB System Average Price from National Gas, plus Henry Hub, World Bank Europe gas and Japan LNG. Updated as sources publish.";
export const GAS_H1 = "UK gas price today";

export const DATA_HEALTH_TITLE = "Data health — Grid";
export const DATA_HEALTH_DESCRIPTION =
  "Published time from each source and when Grid retrieved it, checked against that series' expected cadence and publication lag.";
export const DATA_HEALTH_H1 = "Data health";

export const METHODOLOGY_TITLE = "How Grid's numbers are made: sources and method";
export const METHODOLOGY_DESCRIPTION =
  "Every source, unit, refresh time and calculation behind Grid, including licences: Elexon BMRS, NESO, Carbon Intensity API and Sheffield Solar.";
export const METHODOLOGY_H1 = "How Grid's numbers are made";

export const MAP_TITLE = "GB power asset map: plants and DNO areas";
export const MAP_DESCRIPTION =
  "Power stations from the REPD and DUKES registers, with DNO licence areas on an OS Open Zoomstack basemap.";
export const ASSETS_TITLE = "GB stations, interconnectors and gas terminals";
export const ASSETS_DESCRIPTION =
  "Operational stations from REPD and DUKES, Elexon interconnectors, and National Gas terminal names.";

export const API_DOCS_TITLE = "Free GB electricity data API: Grid";
export const API_DOCS_DESCRIPTION =
  "JSON endpoints for GB carbon intensity, generation mix, demand, prices and commodities. No key, 60 requests a minute, CC BY 4.0 derived data.";
export const API_DOCS_H1 = "Free GB electricity data API";

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
