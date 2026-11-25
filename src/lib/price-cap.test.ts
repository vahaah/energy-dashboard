import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { priceCapJsonLd } from "@/lib/jsonld";
import {
  CURRENT_PRICE_CAP,
  JANUARY_2027_PRICE_CAP,
  OFGEM_JAN_2027_ANNOUNCEMENT_LABEL,
  PRICE_CAP_FAQS,
  PUBLISHED_PRICE_CAPS,
  priceCapAnswerFirst,
  priceCapLlmsLine,
  priceCapOgImagePath,
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

  it("publishes the Ofgem January 2027 cap and reconciles the rates", () => {
    expect(JANUARY_2027_PRICE_CAP).toMatchObject({
      typicalDualFuelDirectDebitGbp: 2166,
      announcedOn: "2026-11-25",
      ofgemRisePercent: 26,
      electricity: { unitPencePerKwh: 32.69, standingChargePencePerDay: 54.77 },
      gas: { unitPencePerKwh: 10.96, standingChargePencePerDay: 29.65 },
      previousElectricity: { unitPencePerKwh: 26.32, standingChargePencePerDay: 54.83 },
      previousGas: { unitPencePerKwh: 7.97, standingChargePencePerDay: 29.68 },
    });
    expect(JANUARY_2027_PRICE_CAP?.sourceUrl).toBe(
      "https://www.ofgem.gov.uk/press-release/energy-price-cap-rise-26-january-2027",
    );
    const sentence = priceCapAnswerFirst();
    expect(sentence).toContain("£2,166");
    expect(sentence).toContain("£443");
    expect(sentence).toContain("26%");
    expect(sentence).toContain("£1,723");
    expect(sentence).toContain(OFGEM_JAN_2027_ANNOUNCEMENT_LABEL);
    expect(sentence).toContain("Source: Ofgem.");
    expect(sentence).not.toMatch(/pending/i);
    expect(sentence).not.toMatch(/does not show/i);
    expect(sentence).not.toMatch(/we will update/i);
    expect(sentence).not.toMatch(/within the hour/i);

    const card = priceCapPresentation();
    expect(card.h1).toBe("Yes. The January 2027 price cap is £2,166.");
    expect(card.revision).toBe("2026-11-25-2166");
    expect(card.unpublishedParagraph).toBeNull();
    expect(card.home).toEqual({
      figure: "£2,166 a year",
      detail:
        "£443 more than the £1,723 cap in force until 31 December 2026. Ofgem calls this a 26% rise.",
    });
    expect(card.og.metrics).toEqual([
      { label: "Jan–Mar 2027", value: "£2,166" },
      { label: "In force", value: "£1,723" },
    ]);
    expect(priceCapOgImagePath()).toBe("/og?page=price-cap&v=2026-11-25-2166");
    expect(priceCapOgImagePath()).not.toContain("pending");
    expect(priceCapLlmsLine()).toContain("£2,166");
    expect(priceCapLlmsLine()).toContain("£443");

    const rates = card.rates;
    expect(rates).not.toBeNull();
    if (!rates) {
      return;
    }
    expect(rates.periods[0]?.electricity).toMatchObject({
      unit: "26.32p/kWh",
      standing: "54.83p/day",
      annualGbp: 858,
    });
    expect(rates.periods[0]?.gas).toMatchObject({ unit: "7.97p/kWh", standing: "29.68p/day", annualGbp: 865 });
    expect(rates.periods[0]?.electricity.annualGbp + rates.periods[0].gas.annualGbp).toBe(1723);
    expect(rates.periods[0]?.totalGbp).toBe(1723);
    expect(rates.periods[1]?.electricity).toMatchObject({
      unit: "32.69p/kWh",
      standing: "54.77p/day",
      annualGbp: 1017,
    });
    expect(rates.periods[1]?.gas).toMatchObject({ unit: "10.96p/kWh", standing: "29.65p/day", annualGbp: 1149 });
    expect(rates.periods[1]?.electricity.annualGbp + rates.periods[1].gas.annualGbp).toBe(2166);
    expect(rates.periods[1]?.totalGbp).toBe(2166);
    expect(rates.changeGbp).toBe(443);
    expect(rates.totalGbp - rates.previousTotalGbp).toBe(rates.changeGbp);
    expect(rates.changeGbp / CURRENT_PRICE_CAP.typicalDualFuelDirectDebitGbp).not.toBe(0.26);
    expect(rates.vatNote).toContain("There is no VAT on electricity from 1 October 2026 to 30 June 2027.");
    expect(rates.context).toContain("the Middle East conflict is pushing up gas prices");
    expect(rates.context).toContain("the cap covers about 20 million households on SVTs");
    expect(rates.context).toContain("the Government is giving about 20 million households £100 from January");
    const faq = card.faqs.map((item) => `${item.question} ${item.answer}`).join("\n");
    expect(faq).toContain("32.69p/kWh");
    expect(faq).toContain("54.77p/day");
    expect(faq).toContain("10.96p/kWh");
    expect(faq).toContain("29.65p/day");
    expect(faq).toContain("£1,017");
    expect(faq).toContain("£1,149");
    expect(faq).not.toMatch(/pending/i);
    const jsonLd = JSON.stringify(priceCapJsonLd({ faqs: PRICE_CAP_FAQS }));
    expect(jsonLd).toContain("£2,166");
    expect(jsonLd).toContain("32.69p/kWh");
    expect(jsonLd).not.toMatch(/pending/i);

    const today = readFileSync(resolve(process.cwd(), "src/app/today/page.tsx"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "src/components/dashboard.tsx"), "utf8");
    expect(today).toContain("priceCapHomeCardCopy");
    expect(home).toContain("PriceCapHomeCard");
    expect(pageTitleLength(card.title)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(pageDescriptionLength(card.description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
  });

  it("keeps an unpublished January card free of a guessed figure", () => {
    expect(ukDateLabel("2026-11-25", "short")).toBe("25 Nov 2026");
    expect(ukDateLabel("2026-11-25", "long")).toBe("25 November 2026");
    const card = priceCapPresentation(null);
    expect(card.og.metrics.map((metric) => metric.value)).toEqual(["£1,723", "25 Nov 2026"]);
    expect(card.revision).toBe("unpublished");
    expect(card.unpublishedParagraph).toContain(OFGEM_JAN_2027_ANNOUNCEMENT_LABEL);
    expect(card.rates).toBeNull();
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
