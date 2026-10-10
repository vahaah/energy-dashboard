import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX_CHARS,
  HOME_DESCRIPTION,
  HOME_TITLE,
  pageDescriptionLength,
  pageTitleLength,
  RECORDS_DESCRIPTION,
  RECORDS_TITLE,
  TITLE_MAX_CHARS,
} from "@/lib/site";

describe("SEO titles and descriptions", () => {
  it("keeps homepage and records copy within the plan limits", () => {
    expect(HOME_TITLE).toBe("Grid: what's powering Britain's electricity today");
    expect(RECORDS_TITLE).toBe("GB electricity records: wind, solar and carbon");
    expect(pageTitleLength(HOME_TITLE)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(pageTitleLength(RECORDS_TITLE)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(pageDescriptionLength(HOME_DESCRIPTION)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(pageDescriptionLength(RECORDS_DESCRIPTION)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
  });
});
