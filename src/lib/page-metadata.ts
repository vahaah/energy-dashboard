import type { Metadata } from "next";
import {
  DASHBOARD_FOCUSES,
  type DashboardSearchParams,
} from "@/lib/dashboard-search-params";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  generation: {
    title: "What’s powering Britain — Grid",
    description:
      "Live GB generation mix, demand, and embedded wind and solar from Elexon, NESO, and Sheffield Solar PV Live.",
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
    return SITE_URL;
  }
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function ogImageUrl(imagePath: string): string {
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return `${SITE_URL}${imagePath.startsWith("/") ? imagePath : `/${imagePath}`}`;
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
      type: "website",
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

export function homePageMetadata(
  focus: DashboardSearchParams["focus"] = "overview"
): Metadata {
  const copy = FOCUS_PAGE_COPY[focus];
  const path = focus === "overview" ? "/" : `/?focus=${focus}`;
  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path,
    imagePath: `/og?focus=${focus}`,
    imageAlt: copy.title,
  });
}

export function recordsPageMetadata(): Metadata {
  return buildPageMetadata({
    title: "GB electricity records — Grid",
    description:
      "Great Britain electricity records: highest wind and solar, lowest carbon intensity, days since coal power ended, and the first times wind passed each gigawatt. From NESO historic generation mix.",
    path: "/records",
    imagePath: "/records/opengraph-image",
    imageAlt: "GB electricity records — Grid",
  });
}

export function privacyPageMetadata(): Metadata {
  return buildPageMetadata({
    title: "Privacy — Grid",
    description:
      "What Grid collects: Vercel logs and an in-memory API rate limiter. No accounts, no non-essential cookies. UK GDPR. Controller: Comonad Ltd.",
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
