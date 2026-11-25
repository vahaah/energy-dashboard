import type { Metadata } from "next";
import {
  DASHBOARD_FOCUSES,
  isValidDashboardDate,
  type DashboardSearchParams,
} from "@/lib/dashboard-search-params";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
import { isDashboardPeriod } from "@/lib/dashboard-period";
import { balanceEquationSentence, getDisplayedPower } from "@/lib/displayed-demand";
import type { LatestFacts } from "@/lib/facts";
import { CURRENT_PRICE_CAP, JANUARY_2027_PRICE_CAP, priceCapOgImagePath, PUBLISHED_PRICE_CAPS } from "@/lib/price-cap";
import {
  API_DOCS_DESCRIPTION,
  API_DOCS_TITLE,
  ASSETS_TITLE,
  assetsDirectoryDescription,
  MAP_DESCRIPTION,
  MAP_TITLE,
  DATA_HEALTH_DESCRIPTION,
  DATA_HEALTH_TITLE,
  GAS_DESCRIPTION,
  GAS_TITLE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  METHODOLOGY_DESCRIPTION,
  METHODOLOGY_TITLE,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  PRICE_CAP_DESCRIPTION,
  PRICE_CAP_TITLE,
  RECORDS_DESCRIPTION,
  RECORDS_TITLE,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_OG_TYPE,
  TODAY_DESCRIPTION,
  TODAY_TITLE,
} from "@/lib/site";

export type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  imagePath: string;
  imageAlt: string;
  /** False emits noindex,follow. Omitted pages stay indexable. */
  index?: boolean;
  openGraphType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

export const FOCUS_PAGE_COPY = {
  overview: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  generation: {
    title: "What’s powering Britain — Grid",
    description:
      "Latest GB generation mix, demand, and embedded wind and solar from Elexon, NESO, and Sheffield Solar PV Live.",
  },
  price: {
    title: "What does electricity cost? | Grid",
    description:
      "Great Britain short-term wholesale market price (Market Index) and system imbalance price from Elexon BMRS.",
  },
  transfers: {
    title: "Where is power flowing? — Grid",
    description: "Metered interconnector flows into and out of Great Britain from Elexon FUELINST.",
  },
  commodities: {
    title: "Gas and oil prices | Grid",
    description:
      "Brent, Henry Hub, World Bank Pink Sheet gas, and National Gas SAP for context on GB power prices.",
  },
  records: {
    title: "Records — Grid",
    description:
      "Highest wind and solar, lowest carbon, and days since coal power ended, from NESO historic generation mix.",
  },
  carbon: {
    title: "How clean is it? — Grid",
    description:
      "National carbon intensity of GB electricity from the NESO Carbon Intensity API (CC BY 4.0).",
  },
} as const;

export function isDashboardFocus(
  value: string | null | undefined
): value is (typeof DASHBOARD_FOCUSES)[number] {
  if (!value) {
    return false;
  }
  for (const focus of DASHBOARD_FOCUSES) {
    if (focus === value) {
      return true;
    }
  }
  return false;
}

export function canonicalPath(path: string): string {
  if (path === "/" || path === "") {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function ogImageUrl(imagePath: string): string {
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const url = canonicalPath(input.path);
  const image = {
    url: ogImageUrl(input.imagePath),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: input.imageAlt,
  };

  const article = input.openGraphType === "article";
  const openGraph = article
    ? {
        title: input.title,
        description: input.description,
        type: "article" as const,
        locale: "en_GB",
        url,
        siteName: SITE_NAME,
        images: [image],
        publishedTime: input.publishedTime,
        modifiedTime: input.modifiedTime,
      }
    : {
        title: input.title,
        description: input.description,
        type: SITE_OG_TYPE,
        locale: "en_GB",
        url,
        siteName: SITE_NAME,
        images: [image],
      };

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
    },
    openGraph,
    ...(input.index === false ? { robots: { index: false, follow: true } } : {}),
    twitter: {
      card: "summary_large_image" as const,
      title: input.title,
      description: input.description,
      images: [{ url: image.url, alt: input.imageAlt }],
    },
  };
}

export type ShareView = {
  date?: string | null;
  period?: string | null;
};

function shareQuery(view?: ShareView): string {
  const params = new URLSearchParams();
  if (view?.date && isValidDashboardDate(view.date)) {
    params.set("date", view.date);
  }
  if (view?.period && isDashboardPeriod(view.period) && view.period !== "day") {
    params.set("period", view.period);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ogFocusImagePath(
  focus: DashboardSearchParams["focus"],
  periodStartUtc?: string | null,
): string {
  if (!periodStartUtc) {
    return `/og?focus=${focus}`;
  }
  return `/og?focus=${focus}&p=${ogPeriodStamp(periodStartUtc)}`;
}

export function shareFocusPath(
  focus: DashboardSearchParams["focus"],
  view?: ShareView,
): string {
  return `/share/${focus}${shareQuery(view)}`;
}

export function shareFocusRedirectPath(
  focus: DashboardSearchParams["focus"],
  view?: ShareView,
): string {
  return `/?focus=${focus}${shareQuery(view).replace("?", "&")}`;
}

export function sharePageMetadata(
  focus: DashboardSearchParams["focus"],
  periodStartUtc?: string | null,
): Metadata {
  const copy = FOCUS_PAGE_COPY[focus];
  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/",
    imagePath: ogFocusImagePath(focus, periodStartUtc),
    imageAlt: copy.title,
    index: false,
  });
}

export function periodStartFromFacts(facts: LatestFacts | null): string | null {
  if (!facts || facts.empty) {
    return null;
  }
  const power = getDisplayedPower(facts);
  return power.generationStartUtc ?? power.demandStartUtc ?? null;
}

function ogPeriodStamp(periodStartUtc: string): string {
  return `${new Date(periodStartUtc).toISOString().slice(0, 16)}Z`;
}

export function ogPeriodImagePath(periodStartUtc: string): string {
  return `/og?p=${ogPeriodStamp(periodStartUtc)}`;
}

export function todayOgImagePath(periodStartUtc?: string | null): string {
  if (!periodStartUtc) {
    return "/og?page=today";
  }
  return `/og?page=today&p=${ogPeriodStamp(periodStartUtc)}`;
}

export function homepageOgImage(payload: DashboardPayload | null): {
  url: string;
  width: number;
  height: number;
  alt: string;
} {
  if (!payload) {
    return SITE_OG_IMAGE;
  }
  const hydrated = hydrateDashboardPayload(payload);
  const power = getDisplayedPower(hydrated.facts, hydrated.headlineSnapshots);
  const start = power.generationStartUtc ?? power.demandStartUtc;
  return {
    url: start ? ogPeriodImagePath(start) : SITE_OG_IMAGE.url,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: power.terms.length > 0 ? balanceEquationSentence(power) : HOME_TITLE,
  };
}

export function homePageMetadata(): Metadata {
  return buildPageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    imagePath: SITE_OG_IMAGE.url,
    imageAlt: SITE_OG_IMAGE.alt,
  });
}

export function recordsPageMetadata(): Metadata {
  return buildPageMetadata({
    title: RECORDS_TITLE,
    description: RECORDS_DESCRIPTION,
    path: "/records",
    imagePath: "/records/opengraph-image",
    imageAlt: RECORDS_TITLE,
  });
}

export const PRIVACY_TITLE = "Privacy | Grid";
export const PRIVACY_DESCRIPTION =
  "What Grid collects: Vercel request logs, a one-minute API rate limiter and cookieless Plausible analytics. No accounts or cookies. Controller: Comonad Ltd.";

export const TERMS_TITLE = "Terms of use | Grid";
export const TERMS_DESCRIPTION =
  "Grid is free and informational: figures may be late or wrong, there is no warranty and no financial advice. Published data keeps the licence of its source.";

export const DATA_SOURCES_TITLE = "Data sources and licences | Grid";
export const DATA_SOURCES_DESCRIPTION =
  "Every source Grid republishes, with its licence and required attribution: Elexon BMRS, NESO, Carbon Intensity API, PV_Live, National Gas, EIA and more.";

export function privacyPageMetadata(): Metadata {
  return buildPageMetadata({
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    path: "/privacy",
    imagePath: "/privacy/opengraph-image",
    imageAlt: PRIVACY_TITLE,
  });
}

export function termsPageMetadata(): Metadata {
  return buildPageMetadata({
    title: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    path: "/terms",
    imagePath: "/terms/opengraph-image",
    imageAlt: TERMS_TITLE,
  });
}

export function dataSourcesPageMetadata(): Metadata {
  return buildPageMetadata({
    title: DATA_SOURCES_TITLE,
    description: DATA_SOURCES_DESCRIPTION,
    path: "/data-sources",
    imagePath: "/data-sources/opengraph-image",
    imageAlt: DATA_SOURCES_TITLE,
  });
}

export function todayPageMetadata(periodStartUtc?: string | null): Metadata {
  return buildPageMetadata({
    title: TODAY_TITLE,
    description: TODAY_DESCRIPTION,
    path: "/today",
    imagePath: todayOgImagePath(periodStartUtc),
    imageAlt: TODAY_TITLE,
  });
}

export function priceCapPageMetadata(): Metadata {
  return buildPageMetadata({
    title: PRICE_CAP_TITLE,
    description: PRICE_CAP_DESCRIPTION,
    path: "/explained/price-cap",
    imagePath: priceCapOgImagePath(),
    imageAlt: PRICE_CAP_TITLE,
    openGraphType: "article",
    publishedTime: PUBLISHED_PRICE_CAPS[0]?.announcedOn,
    modifiedTime: JANUARY_2027_PRICE_CAP?.announcedOn ?? CURRENT_PRICE_CAP.announcedOn,
  });
}

export function gasPageMetadata(): Metadata {
  return buildPageMetadata({
    title: GAS_TITLE,
    description: GAS_DESCRIPTION,
    path: "/prices/gas",
    imagePath: "/prices/gas/opengraph-image",
    imageAlt: GAS_TITLE,
  });
}

export function dataHealthPageMetadata(): Metadata {
  return buildPageMetadata({
    title: DATA_HEALTH_TITLE,
    description: DATA_HEALTH_DESCRIPTION,
    path: "/data-health",
    imagePath: "/data-health/opengraph-image",
    imageAlt: DATA_HEALTH_TITLE,
  });
}

export function methodologyPageMetadata(): Metadata {
  return buildPageMetadata({
    title: METHODOLOGY_TITLE,
    description: METHODOLOGY_DESCRIPTION,
    path: "/methodology",
    imagePath: "/methodology/opengraph-image",
    imageAlt: METHODOLOGY_TITLE,
  });
}

export function mapPageMetadata(): Metadata {
  return buildPageMetadata({
    title: MAP_TITLE,
    description: MAP_DESCRIPTION,
    path: "/map",
    imagePath: "/map/opengraph-image",
    imageAlt: MAP_TITLE,
  });
}

export function assetsPageMetadata(assetCount: number): Metadata {
  return buildPageMetadata({
    title: ASSETS_TITLE,
    description: assetsDirectoryDescription(assetCount),
    path: "/assets",
    imagePath: "/assets/opengraph-image",
    imageAlt: ASSETS_TITLE,
  });
}

export function apiDocsPageMetadata(): Metadata {
  return buildPageMetadata({
    title: API_DOCS_TITLE,
    description: API_DOCS_DESCRIPTION,
    path: "/api",
    imagePath: "/og?page=api",
    imageAlt: API_DOCS_TITLE,
  });
}
