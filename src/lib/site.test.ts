import { describe, expect, it } from "vitest";
import {
  API_DOCS_DESCRIPTION,
  API_DOCS_TITLE,
  ASSETS_DESCRIPTION,
  ASSETS_TITLE,
  DATA_HEALTH_DESCRIPTION,
  DATA_HEALTH_TITLE,
  MAP_DESCRIPTION,
  MAP_TITLE,
  DESCRIPTION_MAX_CHARS,
  GAS_DESCRIPTION,
  GAS_TITLE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  METHODOLOGY_DESCRIPTION,
  METHODOLOGY_TITLE,
  pageDescriptionLength,
  pageTitleLength,
  PRICE_CAP_DESCRIPTION,
  PRICE_CAP_TITLE,
  RECORDS_DESCRIPTION,
  RECORDS_TITLE,
  SITE_OG_IMAGE,
  SITE_ORIGIN,
  SITE_TWITTER_CARD,
  SITE_URL,
  TITLE_MAX_CHARS,
  TODAY_DESCRIPTION,
  TODAY_TITLE,
} from "@/lib/site";

describe("SEO titles and descriptions", () => {
  it("keeps homepage, records and P1 copy within the plan limits", () => {
    expect(SITE_ORIGIN).toBe("https://grid.vahaah.com");
    expect(SITE_URL).toBe(SITE_ORIGIN);
    expect(HOME_TITLE).toBe("What's powering electricity in Great Britain? | Grid");
    expect(RECORDS_TITLE).toBe("GB electricity records: wind, carbon, renewables | Grid");
    expect(TODAY_TITLE).toBe("GB electricity today: live mix and wholesale price | Grid");
    expect(PRICE_CAP_TITLE).toBe("Energy price cap January 2027: will bills go up? | Grid");
    expect(HOME_DESCRIPTION).toContain("Live GB electricity mix");
    expect(HOME_DESCRIPTION).toContain("wholesale prices");
    expect(TODAY_DESCRIPTION).toContain("Elexon wholesale market price");
    expect(PRICE_CAP_DESCRIPTION).toContain("£1,723");
    expect(PRICE_CAP_DESCRIPTION).toContain("25 November 2026");
    expect(GAS_DESCRIPTION).toContain("System Average Price");
    expect(GAS_DESCRIPTION).toContain("p/therm");
    const titles = [
      HOME_TITLE,
      RECORDS_TITLE,
      TODAY_TITLE,
      PRICE_CAP_TITLE,
      GAS_TITLE,
      METHODOLOGY_TITLE,
      API_DOCS_TITLE,
      DATA_HEALTH_TITLE,
      MAP_TITLE,
      ASSETS_TITLE,
    ];
    const descriptions = [
      HOME_DESCRIPTION,
      RECORDS_DESCRIPTION,
      TODAY_DESCRIPTION,
      PRICE_CAP_DESCRIPTION,
      GAS_DESCRIPTION,
      METHODOLOGY_DESCRIPTION,
      API_DOCS_DESCRIPTION,
      DATA_HEALTH_DESCRIPTION,
      MAP_DESCRIPTION,
      ASSETS_DESCRIPTION,
    ];
    for (const title of titles) {
      expect(title.endsWith(" | Grid")).toBe(true);
      expect(pageTitleLength(title)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    }
    for (const description of descriptions) {
      expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    }
    expect(SITE_OG_IMAGE.url).toBe("/og");
    expect(SITE_TWITTER_CARD.images).toEqual(["/og"]);
    expect(GAS_TITLE).not.toMatch(/NBP|JKM/);
    expect(GAS_DESCRIPTION).not.toMatch(/NBP|JKM/);
    expect(GAS_TITLE).toContain("SAP");
    expect(GAS_TITLE).toContain("Henry Hub");
    expect(GAS_DESCRIPTION).toContain("National Gas");
    expect(GAS_DESCRIPTION).toContain("Henry Hub");
    expect(GAS_DESCRIPTION).toContain("European gas");
    expect(GAS_DESCRIPTION).toContain("Japan LNG");
  });
});
