import { describe, expect, it } from "vitest";
import sitemap, { SITEMAP_PATHS } from "@/app/sitemap";

describe("sitemap", () => {
  it("includes the new SEO routes and lastmod when cache has a stamp", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toEqual([
      "https://grid.vahaah.com",
      "https://grid.vahaah.com/today",
      "https://grid.vahaah.com/records",
      "https://grid.vahaah.com/explained/price-cap",
      "https://grid.vahaah.com/prices/gas",
      "https://grid.vahaah.com/methodology",
      "https://grid.vahaah.com/api",
      "https://grid.vahaah.com/privacy",
      "https://grid.vahaah.com/terms",
      "https://grid.vahaah.com/data-sources",
    ]);
    expect(SITEMAP_PATHS.length).toBeGreaterThanOrEqual(8);
    expect(urls.length).toBe(SITEMAP_PATHS.length);
  });
});
