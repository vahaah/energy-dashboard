import { describe, expect, it } from "vitest";
import {
  buildPageMetadata,
  dataSourcesPageMetadata,
  homePageMetadata,
  privacyPageMetadata,
  recordsPageMetadata,
  termsPageMetadata,
} from "@/lib/page-metadata";

describe("page metadata", () => {
  it("sets openGraph, twitter summary_large_image, and a canonical URL", () => {
    const metadata = buildPageMetadata({
      title: "Terms — Grid",
      description: "Informational only.",
      path: "/terms",
      imagePath: "/terms/opengraph-image",
      imageAlt: "Terms — Grid",
    });

    expect(metadata.alternates?.canonical).toBe("https://grid.vahaah.com/terms");
    expect(metadata.openGraph?.url).toBe("https://grid.vahaah.com/terms");
    expect(JSON.stringify(metadata.twitter)).toContain("summary_large_image");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "https://grid.vahaah.com/terms/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Terms — Grid",
      },
    ]);
  });

  it("points homepage focus shares at /og?focus= and keeps overview canonical clean", () => {
    const overview = homePageMetadata("overview");
    expect(overview.alternates?.canonical).toBe("https://grid.vahaah.com");
    expect(overview.openGraph?.images).toEqual([
      {
        url: "https://grid.vahaah.com/og?focus=overview",
        width: 1200,
        height: 630,
        alt: overview.title,
      },
    ]);

    const carbon = homePageMetadata("carbon");
    expect(carbon.alternates?.canonical).toBe("https://grid.vahaah.com/?focus=carbon");
    expect(carbon.openGraph?.images).toEqual([
      {
        url: "https://grid.vahaah.com/og?focus=carbon",
        width: 1200,
        height: 630,
        alt: carbon.title,
      },
    ]);
    expect(JSON.stringify(carbon.twitter)).toContain("summary_large_image");
  });

  it("covers records and the legal pages", () => {
    expect(recordsPageMetadata().alternates?.canonical).toBe("https://grid.vahaah.com/records");
    expect(privacyPageMetadata().alternates?.canonical).toBe("https://grid.vahaah.com/privacy");
    expect(termsPageMetadata().alternates?.canonical).toBe("https://grid.vahaah.com/terms");
    expect(dataSourcesPageMetadata().alternates?.canonical).toBe(
      "https://grid.vahaah.com/data-sources"
    );
  });
});
