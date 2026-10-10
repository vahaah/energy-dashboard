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

export const CURRENT_PRICE_CAP = PUBLISHED_PRICE_CAPS[PUBLISHED_PRICE_CAPS.length - 1];

export function priceCapAnswerFirst(): string {
  return `Ofgem will announce the price cap for 1 January to 31 March 2027 on 25 November 2026. The current cap (1 October to 31 December 2026) is £1,723 a year for a typical dual-fuel Direct Debit household. Until Ofgem publishes that figure, Grid does not show a January 2027 cap. Source: Ofgem.`;
}

export const PRICE_CAP_FAQS = [
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
      "The wholesale allowance in the cap follows observed wholesale prices, including gas. Gas-fired stations also often set Britain's wholesale electricity price, so GB gas SAP is useful context. Grid does not forecast the next cap.",
  },
  {
    question: "Does the cap apply to fixed tariffs?",
    answer:
      "No. The cap covers default (standard variable) tariffs paid by Direct Debit, standard credit or prepayment, including Economy 7. A fixed deal you already agreed is a contract, not the cap.",
  },
] as const;
