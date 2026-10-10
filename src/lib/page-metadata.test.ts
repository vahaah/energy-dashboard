import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPageMetadata,
  dataSourcesPageMetadata,
  homePageMetadata,
  ogFocusImagePath,
  privacyPageMetadata,
  recordsPageMetadata,
  termsPageMetadata,
} from "@/lib/page-metadata";
import { HOME_TITLE, RECORDS_TITLE, SITE_OG_IMAGE } from "@/lib/site";

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

  it("keeps per-section cards on /og?focus= and off page metadata", () => {
    expect(ogFocusImagePath("carbon")).toBe("/og?focus=carbon");
    expect(ogFocusImagePath("overview")).toBe("/og?focus=overview");
    expect(JSON.stringify(homePageMetadata())).not.toContain("focus=");
  });

  it("covers records and the legal pages", () => {
    expect(recordsPageMetadata().title).toBe(RECORDS_TITLE);
    expect(recordsPageMetadata().alternates?.canonical).toBe("/records");
    expect(privacyPageMetadata().alternates?.canonical).toBe("/privacy");
    expect(termsPageMetadata().alternates?.canonical).toBe("/terms");
    expect(dataSourcesPageMetadata().alternates?.canonical).toBe("/data-sources");
  });

  it("does not ship root file-based OG routes", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/opengraph-image.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/twitter-image.tsx"))).toBe(false);
  });
});
