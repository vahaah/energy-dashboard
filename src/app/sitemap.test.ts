import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes the homepage, records, and legal pages", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://grid.vahaah.com",
      "https://grid.vahaah.com/records",
      "https://grid.vahaah.com/privacy",
      "https://grid.vahaah.com/terms",
      "https://grid.vahaah.com/data-sources",
    ]);
  });
});
