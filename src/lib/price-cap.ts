export const OFGEM_PRICE_CAP_HUB_URL =
  "https://www.ofgem.gov.uk/information-consumers/energy-advice-households/energy-price-cap-unit-rates-and-standing-charges";

export const OFGEM_JAN_2027_ANNOUNCEMENT_DATE = "2026-11-25";
export const OFGEM_JAN_2027_ANNOUNCEMENT_LABEL = "25 November 2026";
export const PRICE_CAP_OBSERVATION_WINDOW = {
  from: "2026-08-19",
  to: "2026-11-17",
} as const;

export type PublishedPriceCap = {
  periodFrom: string;
  periodTo: string;
  periodLabel: string;
  typicalDualFuelDirectDebitGbp: number;
  announcedOn: string;
  announcedLabel: string;
  sourceUrl: string;
  sourceLabel: string;
  notes: string[];
};

export type January2027Cap = {
  typicalDualFuelDirectDebitGbp: number;
  announcedOn: string;
  sourceUrl: string;
};

/**
 * January–March 2027 cap. This is the only place to enter Ofgem's figure.
 *
 * Leave `null` until the number is on ofgem.gov.uk. Then set:
 * - `typicalDualFuelDirectDebitGbp`: typical dual-fuel Direct Debit, whole pounds a year
 * - `announcedOn`: the press-release date, `YYYY-MM-DD`
 * - `sourceUrl`: the `https://www.ofgem.gov.uk/` page that states the figure
 *
 * Page copy, the FAQ, JSON-LD and the Open Graph card all read this value.
 * Do not estimate the figure.
 *
 * Checked 24 November 2026. The unit-rates page and the price-cap guidance
 * still publish £1,723 for 1 October to 31 December 2026, and say the next
 * level is announced by 25 November 2026. No January 2027 figure was there.
 * https://www.ofgem.gov.uk/information-consumers/energy-advice-households/energy-price-cap-unit-rates-and-standing-charges
 * https://www.ofgem.gov.uk/energy-regulation/domestic-and-non-domestic/energy-pricing-rules/energy-price-cap
 */
export const JANUARY_2027_PRICE_CAP: January2027Cap | null = null;

export const PUBLISHED_PRICE_CAPS: PublishedPriceCap[] = [
  {
    periodFrom: "2026-01-01",
    periodTo: "2026-03-31",
    periodLabel: "1 January to 31 March 2026",
    typicalDualFuelDirectDebitGbp: 1758,
    announcedOn: "2025-11-21",
    announcedLabel: "21 November 2025",
    sourceUrl:
      "https://www.ofgem.gov.uk/news/changes-energy-price-cap-between-1-january-and-31-march-2026",
    sourceLabel: "Ofgem, 21 November 2025",
    notes: [
      "Typical dual-fuel Direct Debit household on the 2023 Typical Domestic Consumption Values.",
    ],
  },
  {
    periodFrom: "2026-04-01",
    periodTo: "2026-06-30",
    periodLabel: "1 April to 30 June 2026",
    typicalDualFuelDirectDebitGbp: 1641,
    announcedOn: "2026-02-25",
    announcedLabel: "25 February 2026",
    sourceUrl:
      "https://www.ofgem.gov.uk/news/changes-energy-price-cap-between-1-april-and-30-june-2026",
    sourceLabel: "Ofgem, 25 February 2026",
    notes: [
      "Typical dual-fuel Direct Debit household on the 2023 Typical Domestic Consumption Values.",
    ],
  },
  {
    periodFrom: "2026-07-01",
    periodTo: "2026-09-30",
    periodLabel: "1 July to 30 September 2026",
    typicalDualFuelDirectDebitGbp: 1663,
    announcedOn: "2026-05-27",
    announcedLabel: "27 May 2026",
    sourceUrl: "https://www.ofgem.gov.uk/press-release/energy-price-cap-will-rise-13-july",
    sourceLabel: "Ofgem, 27 May 2026",
    notes: [
      "Ofgem restated Typical Domestic Consumption Values from 1 July 2026 (2,500 kWh electricity and 9,500 kWh gas). On the previous TDCV the same cap was presented as £1,862.",
    ],
  },
  {
    periodFrom: "2026-10-01",
    periodTo: "2026-12-31",
    periodLabel: "1 October to 31 December 2026",
    typicalDualFuelDirectDebitGbp: 1723,
    announcedOn: "2026-08-26",
    announcedLabel: "26 August 2026",
    sourceUrl: "https://www.ofgem.gov.uk/press-release/energy-price-cap-will-rise-4-october-2026",
    sourceLabel: "Ofgem, 26 August 2026",
    notes: [
      "Current cap. Typical dual-fuel Direct Debit household on the 2026 Typical Domestic Consumption Values.",
    ],
  },
];

export const CURRENT_PRICE_CAP = PUBLISHED_PRICE_CAPS[PUBLISHED_PRICE_CAPS.length - 1]!;

export type PriceCapFaq = { question: string; answer: string };

export type PriceCapOgFields = {
  title: string;
  kicker: string;
  metrics: { label: string; value: string }[];
};

export type PriceCapPresentation = {
  title: string;
  description: string;
  h1: string;
  answer: string;
  updated: string;
  januaryParagraphs: string[];
  unpublishedParagraph: string | null;
  faqs: PriceCapFaq[];
  og: PriceCapOgFields;
  revision: string;
  caps: PublishedPriceCap[];
  llms: string;
};

const PENDING_TITLE = "Energy price cap January 2027: will bills go up? | Grid";
const PENDING_DESCRIPTION =
  "Ofgem's January–March 2027 price cap is announced on 25 November 2026. The cap is £1,723 a year now. What sets it, what gas has done, and what it covers.";
const PENDING_H1 = "Will energy bills go up in January 2027?";

export function formatCapPounds(gbp: number): string {
  return `£${gbp.toLocaleString("en-GB")}`;
}

export function ukDateLabel(iso: string, month: "long" | "short"): string {
  const [year, monthIndex, day] = iso.split("-").map(Number);
  if (!year || !monthIndex || !day) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex - 1, day)));
}

function isRealIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return false;
  }
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function assertJanuaryCap(cap: January2027Cap): void {
  if (!Number.isInteger(cap.typicalDualFuelDirectDebitGbp) || cap.typicalDualFuelDirectDebitGbp <= 0) {
    throw new Error("JANUARY_2027_PRICE_CAP must be a positive whole number of pounds");
  }
  if (!isRealIsoDate(cap.announcedOn)) {
    throw new Error("JANUARY_2027_PRICE_CAP.announcedOn must be a real YYYY-MM-DD date");
  }
  let url: URL;
  try {
    url = new URL(cap.sourceUrl);
  } catch {
    throw new Error("JANUARY_2027_PRICE_CAP.sourceUrl must be an ofgem.gov.uk URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "www.ofgem.gov.uk") {
    throw new Error("JANUARY_2027_PRICE_CAP.sourceUrl must be an https://www.ofgem.gov.uk/ page");
  }
}

export function january2027Record(cap: January2027Cap): PublishedPriceCap {
  assertJanuaryCap(cap);
  const announcedLabel = ukDateLabel(cap.announcedOn, "long");
  return {
    periodFrom: "2027-01-01",
    periodTo: "2027-03-31",
    periodLabel: "1 January to 31 March 2027",
    typicalDualFuelDirectDebitGbp: cap.typicalDualFuelDirectDebitGbp,
    announcedOn: cap.announcedOn,
    announcedLabel,
    sourceUrl: cap.sourceUrl,
    sourceLabel: `Ofgem, ${announcedLabel}`,
    notes: [
      "Typical dual-fuel Direct Debit household on the 2026 Typical Domestic Consumption Values.",
    ],
  };
}

export function visiblePriceCaps(next: January2027Cap | null = JANUARY_2027_PRICE_CAP): PublishedPriceCap[] {
  if (!next) {
    return PUBLISHED_PRICE_CAPS;
  }
  return [...PUBLISHED_PRICE_CAPS, january2027Record(next)];
}

function pendingAnswer(): string {
  return `Ofgem will announce the price cap for 1 January to 31 March 2027 on 25 November 2026. The current cap (1 October to 31 December 2026) is £1,723 a year for a typical dual-fuel Direct Debit household. Until Ofgem publishes that figure, Grid does not show a January 2027 cap. Source: Ofgem.`;
}

function pendingFaqs(): PriceCapFaq[] {
  return [
    {
      question: "How much is the price cap now?",
      answer: `£${CURRENT_PRICE_CAP.typicalDualFuelDirectDebitGbp.toLocaleString("en-GB")} a year for a typical dual-fuel Direct Debit household (${CURRENT_PRICE_CAP.periodLabel}). Source: Ofgem.`,
    },
    {
      question: "When is the January 2027 price cap announced?",
      answer:
        "Ofgem says it will announce the cap for 1 January to 31 March 2027 on 25 November 2026. It may publish earlier. Grid shows only caps Ofgem has already published.",
    },
    {
      question: "What does the price cap limit?",
      answer:
        "It limits the unit rates and standing charges a supplier can charge customers on a default tariff. It is not a cap on the total bill: using more energy costs more. Fixed tariffs are outside the cap.",
    },
    {
      question: "Why does the gas price affect electricity bills?",
      answer:
        "The wholesale allowance in the cap follows observed wholesale prices, including gas. Gas-fired stations also often set the GB wholesale electricity price, so GB gas SAP is useful context. Grid does not forecast the next cap.",
    },
    {
      question: "Does the cap apply to fixed tariffs?",
      answer:
        "No. The cap covers default (standard variable) tariffs paid by Direct Debit, standard credit or prepayment, including Economy 7. A fixed deal you already agreed is a contract, not the cap.",
    },
  ];
}

function januaryHeading(nextPounds: number, currentPounds: number, formatted: string): string {
  if (nextPounds > currentPounds) {
    return `Yes. The January 2027 price cap is ${formatted}.`;
  }
  if (nextPounds < currentPounds) {
    return `No. The January 2027 price cap is ${formatted}.`;
  }
  return `The January 2027 price cap is unchanged at ${formatted}.`;
}

export function priceCapPresentation(next: January2027Cap | null = JANUARY_2027_PRICE_CAP): PriceCapPresentation {
  const currentPounds = CURRENT_PRICE_CAP.typicalDualFuelDirectDebitGbp;
  const currentFormatted = formatCapPounds(currentPounds);
  if (!next) {
    return {
      title: PENDING_TITLE,
      description: PENDING_DESCRIPTION,
      h1: PENDING_H1,
      answer: pendingAnswer(),
      updated: `Ofgem figures as published · Next announcement ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}`,
      januaryParagraphs: [
        `Ofgem announces the January–March 2027 cap on ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}. Grid is not showing a January 2027 figure until Ofgem publishes one.`,
        `The current cap (${CURRENT_PRICE_CAP.periodLabel}) is ${currentFormatted} a year for a typical dual-fuel Direct Debit household.`,
      ],
      unpublishedParagraph: `Ofgem announces the next cap, covering 1 January to 31 March 2027, on ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}. That page may appear earlier. Grid is not showing a January 2027 figure, and this page does not forecast one.`,
      faqs: pendingFaqs(),
      og: {
        title: PENDING_H1,
        kicker: `Ofgem announces the next cap on ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}.`,
        metrics: [
          { label: "Current cap", value: currentFormatted },
          { label: "Next announcement", value: ukDateLabel(OFGEM_JAN_2027_ANNOUNCEMENT_DATE, "short") },
        ],
      },
      revision: "pending",
      caps: PUBLISHED_PRICE_CAPS,
      llms: `Ofgem price cap: ${currentFormatted} a year (typical dual-fuel Direct Debit, ${CURRENT_PRICE_CAP.periodLabel}). Next cap announced ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}.`,
    };
  }

  const record = january2027Record(next);
  const formatted = formatCapPounds(record.typicalDualFuelDirectDebitGbp);
  const h1 = januaryHeading(record.typicalDualFuelDirectDebitGbp, currentPounds, formatted);
  const description = `Ofgem set the January–March 2027 cap at ${formatted} a year. The cap in force until 31 December 2026 is ${currentFormatted}. Typical dual-fuel Direct Debit.`;
  return {
    title: `January 2027 energy price cap: ${formatted} | Grid`,
    description,
    h1,
    answer: `Ofgem published the price cap for 1 January to 31 March 2027 at ${formatted} a year for a typical dual-fuel Direct Debit household on ${record.announcedLabel}. The cap in force until 31 December 2026 is ${currentFormatted}. Source: Ofgem.`,
    updated: `Ofgem figures as published · January 2027 cap announced ${record.announcedLabel}`,
    januaryParagraphs: [
      `Ofgem published the cap for 1 January to 31 March 2027 at ${formatted} a year for a typical dual-fuel Direct Debit household on ${record.announcedLabel}.`,
      `The cap in force until 31 December 2026 (${CURRENT_PRICE_CAP.periodLabel}) is ${currentFormatted} a year for the same household.`,
    ],
    unpublishedParagraph: null,
    faqs: [
      pendingFaqs()[0]!,
      {
        question: "What is the January 2027 price cap?",
        answer: `${formatted} a year for a typical dual-fuel Direct Debit household (1 January to 31 March 2027), published by Ofgem on ${record.announcedLabel}. The cap in force until 31 December 2026 is ${currentFormatted}.`,
      },
      ...pendingFaqs().slice(2),
    ],
    og: {
      title: `January 2027 cap is ${formatted}`,
      kicker: `Announced ${ukDateLabel(record.announcedOn, "short")}. In force until 31 December 2026: ${currentFormatted}.`,
      metrics: [
        { label: "Jan–Mar 2027", value: formatted },
        { label: "In force", value: currentFormatted },
      ],
    },
    revision: `${record.announcedOn}-${record.typicalDualFuelDirectDebitGbp}`,
    caps: [...PUBLISHED_PRICE_CAPS, record],
    llms: `Ofgem price cap for 1 January to 31 March 2027: ${formatted} a year (typical dual-fuel Direct Debit), announced ${record.announcedLabel}. The cap in force until 31 December 2026 is ${currentFormatted}.`,
  };
}

const PRESENTATION = priceCapPresentation();

export function priceCapAnswerFirst(): string {
  return PRESENTATION.answer;
}

export const PRICE_CAP_FAQS = PRESENTATION.faqs;

export function priceCapTitle(): string {
  return PRESENTATION.title;
}

export function priceCapDescription(): string {
  return PRESENTATION.description;
}

export function priceCapH1(): string {
  return PRESENTATION.h1;
}

export function priceCapOgImagePath(): string {
  return `/og?page=price-cap&v=${PRESENTATION.revision}`;
}

export function priceCapLlmsLine(): string {
  return PRESENTATION.llms;
}
