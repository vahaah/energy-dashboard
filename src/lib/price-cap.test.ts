import { describe, expect, it } from "vitest";
import {
  CURRENT_PRICE_CAP,
  JANUARY_2027_PRICE_CAP,
  OFGEM_JAN_2027_ANNOUNCEMENT_LABEL,
  PUBLISHED_PRICE_CAPS,
  priceCapAnswerFirst,
  priceCapPresentation,
  ukDateLabel,
} from "@/lib/price-cap";
import { DESCRIPTION_MAX_CHARS, pageDescriptionLength, pageTitleLength, TITLE_MAX_CHARS } from "@/lib/site";

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

  it("keeps the January 2027 figure unset until Ofgem publishes it", () => {
    expect(JANUARY_2027_PRICE_CAP).toBeNull();
    expect(ukDateLabel("2026-11-25", "short")).toBe("25 Nov 2026");
    expect(ukDateLabel("2026-11-25", "long")).toBe("25 November 2026");
    const card = priceCapPresentation(null);
    expect(card.og.metrics.map((metric) => metric.value)).toEqual(["£1,723", "25 Nov 2026"]);
    expect(card.revision).toBe("pending");
    expect(card.unpublishedParagraph).toContain(OFGEM_JAN_2027_ANNOUNCEMENT_LABEL);
  });

  it("flows a published January 2027 figure into copy, FAQ and the Open Graph card", () => {
    const published = priceCapPresentation({
      typicalDualFuelDirectDebitGbp: 1800,
      announcedOn: "2026-11-25",
      sourceUrl: "https://www.ofgem.gov.uk/press-release/example-january-2027",
    });
    expect(published.h1).toBe("Yes. The January 2027 price cap is £1,800.");
    expect(published.answer).toContain("£1,800");
    expect(published.answer).toContain("£1,723");
    expect(published.answer).toContain("25 November 2026");
    expect(published.answer).toContain("Source: Ofgem.");
    expect(published.faqs.find((faq) => faq.question.startsWith("What is the January"))?.answer).toContain(
      "£1,800",
    );
    expect(published.og.metrics).toEqual([
      { label: "Jan–Mar 2027", value: "£1,800" },
      { label: "In force", value: "£1,723" },
    ]);
    expect(published.revision).toBe("2026-11-25-1800");
    expect(published.caps.at(-1)?.sourceUrl).toContain("ofgem.gov.uk");
    expect(published.unpublishedParagraph).toBeNull();
    expect(pageTitleLength(published.title)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(pageDescriptionLength(published.description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(published.title).toContain("£1,800");

    const lower = priceCapPresentation({
      typicalDualFuelDirectDebitGbp: 1600,
      announcedOn: "2026-11-25",
      sourceUrl: "https://www.ofgem.gov.uk/press-release/example-january-2027",
    });
    expect(lower.h1.startsWith("No.")).toBe(true);
    const same = priceCapPresentation({
      typicalDualFuelDirectDebitGbp: CURRENT_PRICE_CAP.typicalDualFuelDirectDebitGbp,
      announcedOn: "2026-11-25",
      sourceUrl: "https://www.ofgem.gov.uk/press-release/example-january-2027",
    });
    expect(same.h1).toContain("unchanged");
  });
});
