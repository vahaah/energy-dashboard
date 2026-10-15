import type { Metadata } from "next";
import {
  DASHBOARD_FOCUSES,
  type DashboardSearchParams,
} from "@/lib/dashboard-search-params";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
import { balanceEquationSentence, getDisplayedPower } from "@/lib/displayed-demand";
import {
  API_DOCS_DESCRIPTION,
  API_DOCS_TITLE,
  ASSETS_DESCRIPTION,
  ASSETS_TITLE,
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
    title: "What does power cost? — Grid",
    description:
      "Great Britain short-term wholesale market price (Market Index) and system imbalance price from Elexon BMRS.",
  },
  transfers: {
    title: "Where is power flowing? — Grid",
    description: "Metered interconnector flows into and out of Great Britain from Elexon FUELINST.",
  },
  commodities: {
    title: "Gas & oil — Grid",
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

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      type: SITE_OG_TYPE,
      url,
      siteName: SITE_NAME,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image.url],
    },
  };
}

export function ogFocusImagePath(focus: DashboardSearchParams["focus"]): string {
  return `/og?focus=${focus}`;
}

export function shareFocusPath(focus: DashboardSearchParams["focus"]): string {
  return `/share/${focus}`;
}

export function shareFocusRedirectPath(focus: DashboardSearchParams["focus"]): string {
  return `/?focus=${focus}`;
}

export function sharePageMetadata(focus: DashboardSearchParams["focus"]): Metadata {
  const copy = FOCUS_PAGE_COPY[focus];
  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/",
    imagePath: ogFocusImagePath(focus),
    imageAlt: copy.title,
  });
}

export function ogPeriodImagePath(periodStartUtc: string): string {
  const stamp = `${new Date(periodStartUtc).toISOString().slice(0, 16)}Z`;
  return `/og?p=${stamp}`;
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

export function privacyPageMetadata(): Metadata {
  return buildPageMetadata({
    title: "Privacy — Grid",
    description:
      "What Grid collects: Vercel logs, a one-minute rate limiter, and cookieless Plausible analytics. No accounts, no cookies. UK GDPR. Controller: Comonad Ltd.",
    path: "/privacy",
    imagePath: "/privacy/opengraph-image",
    imageAlt: "Privacy — Grid",
  });
}

export function termsPageMetadata(): Metadata {
  return buildPageMetadata({
    title: "Terms — Grid",
    description:
      "Grid is informational only, with no warranty and no financial advice. The code is MIT-licensed. Liability is limited.",
    path: "/terms",
    imagePath: "/terms/opengraph-image",
    imageAlt: "Terms — Grid",
  });
}

export function dataSourcesPageMetadata(): Metadata {
  return buildPageMetadata({
    title: "Data sources — Grid",
    description:
      "Every Grid data source with its licence and the attribution text that licence requires: Elexon BMRS, NESO, Carbon Intensity API, PV Live, EIA, World Bank, and National Gas.",
    path: "/data-sources",
    imagePath: "/data-sources/opengraph-image",
    imageAlt: "Data sources — Grid",
  });
}

export function todayPageMetadata(): Metadata {
  return buildPageMetadata({
    title: TODAY_TITLE,
    description: TODAY_DESCRIPTION,
    path: "/today",
    imagePath: "/today/opengraph-image",
    imageAlt: TODAY_TITLE,
  });
}

export function priceCapPageMetadata(): Metadata {
  return buildPageMetadata({
    title: PRICE_CAP_TITLE,
    description: PRICE_CAP_DESCRIPTION,
    path: "/explained/price-cap",
    imagePath: "/explained/price-cap/opengraph-image",
    imageAlt: PRICE_CAP_TITLE,
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
    imagePath: "/og",
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

export function assetsPageMetadata(): Metadata {
  return buildPageMetadata({
    title: ASSETS_TITLE,
    description: ASSETS_DESCRIPTION,
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
