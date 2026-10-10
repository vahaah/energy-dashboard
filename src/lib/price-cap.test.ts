import { describe, expect, it } from "vitest";
import {
  CURRENT_PRICE_CAP,
  OFGEM_JAN_2027_ANNOUNCEMENT_LABEL,
  PUBLISHED_PRICE_CAPS,
  priceCapAnswerFirst,
} from "@/lib/price-cap";

describe("published price caps", () => {
  it("lists only Ofgem figures already published, with source and date", () => {
    expect(PUBLISHED_PRICE_CAPS.map((cap) => cap.typicalDualFuelDirectDebitGbp)).toEqual([
      1758, 1641, 1663, 1723,
    ]);
    expect(CURRENT_PRICE_CAP.typicalDualFuelDirectDebitGbp).toBe(1723);
    for (const cap of PUBLISHED_PRICE_CAPS) {
      expect(cap.sourceUrl).toContain("ofgem.gov.uk");
      expect(cap.announcedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cap.periodTo < "2027-01-01").toBe(true);
    }
  });

  it("announces 25 Nov 2026 without a January 2027 figure or an update promise", () => {
    const sentence = priceCapAnswerFirst();
    expect(sentence).toContain(OFGEM_JAN_2027_ANNOUNCEMENT_LABEL);
    expect(sentence).toContain("£1,723");
    expect(sentence).toContain("does not show a January 2027 cap");
    expect(sentence).not.toMatch(/we will update/i);
    expect(sentence).not.toMatch(/within the hour/i);
    expect(sentence).not.toMatch(/January 2027 cap is £/);
    expect(sentence).toContain("£1,723");
  });
});
