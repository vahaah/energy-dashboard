export const SITE_ORIGIN = "https://grid.vahaah.com";
export const SITE_URL = SITE_ORIGIN;
export const SITE_NAME = "Grid";

export const HOME_TITLE = "Grid: what's powering Britain's electricity today";
export const HOME_DESCRIPTION =
  "Britain's electricity mix, carbon intensity, demand and prices, updated hourly from Elexon, NESO and Sheffield Solar. Free, with sources on every number.";

export const RECORDS_TITLE = "GB electricity records: wind, solar and carbon";
export const RECORDS_DESCRIPTION =
  "Highest wind and renewable share and lowest carbon since Grid's records began, shown next to NESO's official records. Sourced from NESO data.";

export const HOME_H1 = "What's powering Britain's electricity today";
export const RECORDS_H1 = "GB electricity records";
export const RECORDS_SUBLINE =
  "Highest and lowest half-hours since Grid's records began (NESO historic data from 2009), shown next to NESO's official records.";

export const DATASET_TEMPORAL_COVERAGE_START = "2025-03-18";

export const SITE_TITLE = HOME_TITLE;
export const SITE_DESCRIPTION = HOME_DESCRIPTION;

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";
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
