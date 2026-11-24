import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPageMetadata,
  apiDocsPageMetadata,
  dataSourcesPageMetadata,
  FOCUS_PAGE_COPY,
  gasPageMetadata,
  homePageMetadata,
  methodologyPageMetadata,
  priceCapPageMetadata,
  ogFocusImagePath,
  ogPeriodImagePath,
  privacyPageMetadata,
  recordsPageMetadata,
  shareFocusPath,
  shareFocusRedirectPath,
  sharePageMetadata,
  termsPageMetadata,
  todayPageMetadata,
} from "@/lib/page-metadata";
import {
  DESCRIPTION_MAX_CHARS,
  HOME_TITLE,
  RECORDS_TITLE,
  SITE_OG_IMAGE,
  pageDescriptionLength,
} from "@/lib/site";

describe("page metadata", () => {
  it("sets openGraph, twitter summary_large_image, and a canonical path", () => {
    const metadata = buildPageMetadata({
      title: "Terms — Grid",
      description: "Informational only.",
      path: "/terms",
      imagePath: "/terms/opengraph-image",
      imageAlt: "Terms — Grid",
    });

    expect(metadata.alternates?.canonical).toBe("/terms");
    expect(metadata.openGraph?.url).toBe("/terms");
    expect(JSON.stringify(metadata.twitter)).toContain("summary_large_image");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "/terms/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Terms — Grid",
      },
    ]);
  });

  it("uses one static /og image for homepage metadata", () => {
    const overview = homePageMetadata();
    expect(overview.title).toBe(HOME_TITLE);
    expect(overview.alternates?.canonical).toBe("/");
    expect(overview.openGraph?.url).toBe("/");
    expect(overview.openGraph?.images).toEqual([SITE_OG_IMAGE]);
    expect(SITE_OG_IMAGE.url).toBe("/og");
    expect(JSON.stringify(overview.twitter)).toContain("summary_large_image");
  });

  it("versions the homepage OG url with an unencoded settlement period", () => {
    expect(ogPeriodImagePath("2026-10-13T08:00:00.000Z")).toBe("/og?p=2026-10-13T08:00Z");
    expect(ogPeriodImagePath("2026-10-13T08:00:00.000Z")).not.toContain("%");
  });

  it("keeps per-section cards on /og?focus= and off homepage metadata", () => {
    expect(ogFocusImagePath("carbon")).toBe("/og?focus=carbon");
    expect(ogFocusImagePath("overview")).toBe("/og?focus=overview");
    expect(ogFocusImagePath("price", "2026-11-24T16:30:00.000Z")).toBe(
      "/og?focus=price&p=2026-11-24T16:30Z",
    );
    expect(shareFocusPath("carbon")).toBe("/share/carbon");
    expect(shareFocusPath("price", { date: "2026-11-20", period: "day" })).toBe(
      "/share/price?date=2026-11-20",
    );
    expect(shareFocusPath("overview", { date: "2026-11-20", period: "week" })).toBe(
      "/share/overview?date=2026-11-20&period=week",
    );
    expect(shareFocusPath("generation", { date: "not-a-date", period: "nope" })).toBe(
      "/share/generation",
    );
    expect(JSON.stringify(homePageMetadata())).not.toContain("focus=");
  });

  it("points share landings at /og?focus= with a homepage canonical", () => {
    const carbon = sharePageMetadata("carbon");
    expect(carbon.alternates?.canonical).toBe("/");
    expect(carbon.robots).toEqual({ index: false, follow: true });
    expect(carbon.openGraph?.url).toBe("/");
    expect(carbon.openGraph?.images).toEqual([
      {
        url: "/og?focus=carbon",
        width: 1200,
        height: 630,
        alt: FOCUS_PAGE_COPY.carbon.title,
      },
    ]);
    const stamped = sharePageMetadata("price", "2026-11-24T16:30:00.000Z");
    expect(JSON.stringify(stamped.openGraph?.images)).toContain("/og?focus=price&p=2026-11-24T16:30Z");
    expect(shareFocusRedirectPath("price", { date: "2026-11-20" })).toBe("/?focus=price&date=2026-11-20");
    expect(shareFocusRedirectPath("overview")).toBe("/?focus=overview");
    expect(FOCUS_PAGE_COPY.generation.description.startsWith("Latest ")).toBe(true);
    expect(FOCUS_PAGE_COPY.generation.description).not.toMatch(/\bLive GB\b/);
  });

  it("covers records and the legal pages", () => {
    expect(recordsPageMetadata().title).toBe(RECORDS_TITLE);
    expect(recordsPageMetadata().alternates?.canonical).toBe("/records");
    expect(privacyPageMetadata().alternates?.canonical).toBe("/privacy");
    const privacyDescription = privacyPageMetadata().description;
    expect(privacyDescription).toContain("cookieless Plausible");
    expect(pageDescriptionLength(String(privacyDescription))).toBeLessThanOrEqual(
      DESCRIPTION_MAX_CHARS,
    );
    expect(termsPageMetadata().alternates?.canonical).toBe("/terms");
    expect(dataSourcesPageMetadata().alternates?.canonical).toBe("/data-sources");
    expect(todayPageMetadata().alternates?.canonical).toBe("/today");
    expect(JSON.stringify(todayPageMetadata().openGraph?.images)).toContain("/og?page=today");
    expect(JSON.stringify(todayPageMetadata("2026-11-24T16:30:00.000Z").openGraph?.images)).toContain(
      "/og?page=today&p=2026-11-24T16:30Z",
    );
    expect(JSON.stringify(todayPageMetadata().openGraph?.images)).not.toContain("/today/opengraph-image");
    expect(priceCapPageMetadata().alternates?.canonical).toBe("/explained/price-cap");
    expect(JSON.stringify(priceCapPageMetadata().openGraph?.images)).toContain("/og?page=price-cap&v=pending");
    expect(gasPageMetadata().alternates?.canonical).toBe("/prices/gas");
    expect(methodologyPageMetadata().alternates?.canonical).toBe("/methodology");
    expect(apiDocsPageMetadata().alternates?.canonical).toBe("/api");
    expect(JSON.stringify(apiDocsPageMetadata().openGraph?.images)).toContain("/og?page=api");
    expect(JSON.stringify(apiDocsPageMetadata().openGraph?.images)).not.toContain(
      "/api/opengraph-image"
    );
  });

  it("does not ship root file-based OG routes or an /api OG image", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/opengraph-image.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/twitter-image.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/api/opengraph-image.tsx"))).toBe(false);
  });
});
