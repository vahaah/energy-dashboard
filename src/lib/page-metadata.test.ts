import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPageMetadata,
  dataSourcesPageMetadata,
  homePageMetadata,
  privacyPageMetadata,
  recordsPageMetadata,
  termsPageMetadata,
} from "@/lib/page-metadata";
import { HOME_TITLE, RECORDS_TITLE } from "@/lib/site";

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

  it("keeps every homepage URL canonical to / and varies only the OG image", () => {
    const overview = homePageMetadata("overview");
    expect(overview.title).toBe(HOME_TITLE);
    expect(overview.alternates?.canonical).toBe("/");
    expect(overview.openGraph?.url).toBe("/");
    expect(overview.openGraph?.images).toEqual([
      {
        url: "/og?focus=overview",
        width: 1200,
        height: 630,
        alt: overview.title,
      },
    ]);

    const carbon = homePageMetadata("carbon");
    expect(carbon.alternates?.canonical).toBe("/");
    expect(carbon.openGraph?.url).toBe("/");
    expect(carbon.openGraph?.images).toEqual([
      {
        url: "/og?focus=carbon",
        width: 1200,
        height: 630,
        alt: carbon.title,
      },
    ]);
    expect(JSON.stringify(carbon.twitter)).toContain("summary_large_image");
  });

  it("covers records and the legal pages", () => {
    expect(recordsPageMetadata().title).toBe(RECORDS_TITLE);
    expect(recordsPageMetadata().alternates?.canonical).toBe("/records");
    expect(privacyPageMetadata().alternates?.canonical).toBe("/privacy");
    expect(termsPageMetadata().alternates?.canonical).toBe("/terms");
    expect(dataSourcesPageMetadata().alternates?.canonical).toBe("/data-sources");
  });

  it("does not ship root file-based OG routes that would override generateMetadata", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/opengraph-image.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/twitter-image.tsx"))).toBe(false);
  });
});
