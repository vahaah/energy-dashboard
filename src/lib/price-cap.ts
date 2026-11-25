export const OFGEM_PRICE_CAP_HUB_URL =
  "https://www.ofgem.gov.uk/information-consumers/energy-advice-households/get-energy-price-cap-standing-charges-and-unit-rates-region";

/** Ofgem's 2026 typical domestic consumption values, used to turn unit rates into the annual cap. */
export const PRICE_CAP_ELECTRICITY_KWH = 2_500;
export const PRICE_CAP_GAS_KWH = 9_500;
export const PRICE_CAP_BILLING_DAYS = 365;

export const PRICE_CAP_VAT_NOTE =
  "Figures are rounded to two decimal places and include 5% VAT on gas. There is no VAT on electricity from 1 October 2026 to 30 June 2027. Costs cannot be compared directly to previous periods because of this change.";

export const PRICE_CAP_CONTEXT =
  "Ofgem says the Middle East conflict is pushing up gas prices, the cap covers about 20 million households on SVTs, and the Government is giving about 20 million households £100 from January.";

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

export type DirectDebitRate = {
  unitPencePerKwh: number;
  standingChargePencePerDay: number;
};

export type January2027Cap = {
  typicalDualFuelDirectDebitGbp: number;
  announcedOn: string;
  sourceUrl: string;
  ratesUrl?: string;
  electricity?: DirectDebitRate;
  gas?: DirectDebitRate;
  previousElectricity?: DirectDebitRate;
  previousGas?: DirectDebitRate;
  /** Ofgem's stated rise. Not a ratio computed from the pound difference. */
  ofgemRisePercent?: number;
};

/**
 * January–March 2027 cap. This is the only place to enter Ofgem's figure.
 *
 * Page copy, the FAQ, JSON-LD, the Open Graph card, /today, the home card,
 * llms.txt and WebMCP all read this value. Do not estimate the figure.
 *
 * Checked 25 November 2026 against the press release and the unit-rates page.
 * Direct Debit averages: electricity 32.69p/kWh and 54.77p/day, gas 10.96p/kWh
 * and 29.65p/day. The typical dual-fuel bill is £2,166.
 * https://www.ofgem.gov.uk/press-release/energy-price-cap-rise-26-january-2027
 * https://www.ofgem.gov.uk/information-consumers/energy-advice-households/get-energy-price-cap-standing-charges-and-unit-rates-region
 */
export const JANUARY_2027_PRICE_CAP: January2027Cap | null = {
  typicalDualFuelDirectDebitGbp: 2166,
  announcedOn: "2026-11-25",
  sourceUrl: "https://www.ofgem.gov.uk/press-release/energy-price-cap-rise-26-january-2027",
  ratesUrl: OFGEM_PRICE_CAP_HUB_URL,
  electricity: { unitPencePerKwh: 32.69, standingChargePencePerDay: 54.77 },
  gas: { unitPencePerKwh: 10.96, standingChargePencePerDay: 29.65 },
  previousElectricity: { unitPencePerKwh: 26.32, standingChargePencePerDay: 54.83 },
  previousGas: { unitPencePerKwh: 7.97, standingChargePencePerDay: 29.68 },
  ofgemRisePercent: 26,
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

export const CURRENT_PRICE_CAP = PUBLISHED_PRICE_CAPS[PUBLISHED_PRICE_CAPS.length - 1]!;

export type PriceCapFaq = { question: string; answer: string };

export type PriceCapOgFields = {
  title: string;
  kicker: string;
  metrics: { label: string; value: string }[];
};

export type PriceCapFuelBill = {
  unit: string;
  standing: string;
  annualGbp: number;
};

export type PriceCapPeriodBill = {
  label: string;
  electricity: PriceCapFuelBill;
  gas: PriceCapFuelBill;
  totalGbp: number;
};

export type PriceCapRatesView = {
  periods: [PriceCapPeriodBill, PriceCapPeriodBill];
  totalGbp: number;
  previousTotalGbp: number;
  changeGbp: number;
  ofgemRisePercent: number;
  vatNote: string;
  context: string;
  ratesUrl: string;
  basis: string;
};

export type PriceCapHomeCopy = {
  figure: string;
  detail: string;
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
  rates: PriceCapRatesView | null;
  home: PriceCapHomeCopy;
};

const PENDING_TITLE = "Energy price cap January 2027: will bills go up? | Grid";
const PENDING_DESCRIPTION =
  "Ofgem's January–March 2027 price cap is announced on 25 November 2026. The cap is £1,723 a year now. What sets it, what gas has done, and what it covers.";
const PENDING_H1 = "Will energy bills go up in January 2027?";

export function formatCapPounds(gbp: number): string {
  return `£${gbp.toLocaleString("en-GB")}`;
}

function penceLabel(pence: number, unit: "kWh" | "day"): string {
  return `${pence.toFixed(2)}p/${unit}`;
}

/** Unit rate × kWh plus standing charge × days, in pence, from rates stored at 0.01p. */
function annualPence(ratePence: number, quantity: number): number {
  const hundredths = Math.round(ratePence * 100);
  return (hundredths * quantity) / 100;
}

/** Nearest pound, the same rounding that makes the fuel rows add to Ofgem's annual cap. */
export function annualCapPounds(rate: DirectDebitRate, kwh: number): number {
  const pence =
    annualPence(rate.unitPencePerKwh, kwh) + annualPence(rate.standingChargePencePerDay, PRICE_CAP_BILLING_DAYS);
  return Math.round(pence / 100);
}

function fuelBill(rate: DirectDebitRate, kwh: number): PriceCapFuelBill {
  return {
    unit: penceLabel(rate.unitPencePerKwh, "kWh"),
    standing: penceLabel(rate.standingChargePencePerDay, "day"),
    annualGbp: annualCapPounds(rate, kwh),
  };
}

function assertOfgemUrl(value: string, field: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${field} must be an ofgem.gov.uk URL`);
  }
  if (url.protocol !== "https:" || url.hostname !== "www.ofgem.gov.uk") {
    throw new Error(`${field} must be an https://www.ofgem.gov.uk/ page`);
  }
}

/**
 * Direct Debit averages turned into the annual cap. Electricity and gas are
 * each rounded to the nearest pound, then added. The pound change is the
 * difference of those totals. `ofgemRisePercent` is copied from Ofgem.
 */
export function priceCapRatesView(cap: January2027Cap, previousTotalGbp: number): PriceCapRatesView | null {
  const { electricity, gas, previousElectricity, previousGas, ofgemRisePercent, ratesUrl } = cap;
  const anyRate =
    electricity != null ||
    gas != null ||
    previousElectricity != null ||
    previousGas != null ||
    ofgemRisePercent != null ||
    ratesUrl != null;
  if (!anyRate) {
    return null;
  }
  if (!electricity || !gas || !previousElectricity || !previousGas || ofgemRisePercent == null || !ratesUrl) {
    throw new Error("JANUARY_2027_PRICE_CAP rates are incomplete");
  }
  assertOfgemUrl(ratesUrl, "JANUARY_2027_PRICE_CAP.ratesUrl");
  if (!Number.isInteger(ofgemRisePercent) || ofgemRisePercent <= 0 || ofgemRisePercent >= 100) {
    throw new Error("JANUARY_2027_PRICE_CAP.ofgemRisePercent must be a whole number of percent");
  }
  const previous: PriceCapPeriodBill = {
    label: "1 October to 31 December 2026",
    electricity: fuelBill(previousElectricity, PRICE_CAP_ELECTRICITY_KWH),
    gas: fuelBill(previousGas, PRICE_CAP_GAS_KWH),
    totalGbp: 0,
  };
  previous.totalGbp = previous.electricity.annualGbp + previous.gas.annualGbp;
  const next: PriceCapPeriodBill = {
    label: "1 January to 31 March 2027",
    electricity: fuelBill(electricity, PRICE_CAP_ELECTRICITY_KWH),
    gas: fuelBill(gas, PRICE_CAP_GAS_KWH),
    totalGbp: 0,
  };
  next.totalGbp = next.electricity.annualGbp + next.gas.annualGbp;
  if (next.totalGbp !== cap.typicalDualFuelDirectDebitGbp) {
    throw new Error(
      `January 2027 rates sum to £${next.totalGbp}, not £${cap.typicalDualFuelDirectDebitGbp}`,
    );
  }
  if (previous.totalGbp !== previousTotalGbp) {
    throw new Error(`October 2026 rates sum to £${previous.totalGbp}, not £${previousTotalGbp}`);
  }
  return {
    periods: [previous, next],
    totalGbp: next.totalGbp,
    previousTotalGbp: previous.totalGbp,
    changeGbp: next.totalGbp - previous.totalGbp,
    ofgemRisePercent,
    vatNote: PRICE_CAP_VAT_NOTE,
    context: PRICE_CAP_CONTEXT,
    ratesUrl,
    basis: `${PRICE_CAP_ELECTRICITY_KWH.toLocaleString("en-GB")} kWh of electricity and ${PRICE_CAP_GAS_KWH.toLocaleString("en-GB")} kWh of gas over ${PRICE_CAP_BILLING_DAYS} days. Each fuel is rounded to the nearest pound, then added.`,
  };
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
  assertOfgemUrl(cap.sourceUrl, "JANUARY_2027_PRICE_CAP.sourceUrl");
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
      revision: "unpublished",
      caps: PUBLISHED_PRICE_CAPS,
      llms: `Ofgem price cap: ${currentFormatted} a year (typical dual-fuel Direct Debit, ${CURRENT_PRICE_CAP.periodLabel}). Next cap announced ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}.`,
      rates: null,
      home: {
        figure: `${currentFormatted} a year`,
        detail: `The January 2027 cap is announced on ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}.`,
      },
    };
  }

  const record = january2027Record(next);
  const formatted = formatCapPounds(record.typicalDualFuelDirectDebitGbp);
  const rates = priceCapRatesView(next, currentPounds);
  const h1 = januaryHeading(record.typicalDualFuelDirectDebitGbp, currentPounds, formatted);
  const description = `Ofgem set the January–March 2027 cap at ${formatted} a year. The cap in force until 31 December 2026 is ${currentFormatted}. Typical dual-fuel Direct Debit.`;
  const rise = rates
    ? ` That is ${formatCapPounds(rates.changeGbp)} more than ${currentFormatted}. Ofgem calls this a ${rates.ofgemRisePercent}% rise.`
    : "";
  const januaryElectricity = rates?.periods[1].electricity;
  const januaryGas = rates?.periods[1].gas;
  const rateSentence =
    rates && januaryElectricity && januaryGas
      ? ` Direct Debit averages: electricity ${januaryElectricity.unit} and a standing charge of ${januaryElectricity.standing}; gas ${januaryGas.unit} and a standing charge of ${januaryGas.standing}. Electricity ${formatCapPounds(januaryElectricity.annualGbp)} plus gas ${formatCapPounds(januaryGas.annualGbp)} is ${formatted}.`
      : "";
  return {
    title: `January 2027 energy price cap: ${formatted} | Grid`,
    description,
    h1,
    answer: `Ofgem published the price cap for 1 January to 31 March 2027 at ${formatted} a year for a typical dual-fuel Direct Debit household on ${record.announcedLabel}.${rise} The cap in force until 31 December 2026 is ${currentFormatted}. Source: Ofgem.`,
    updated: `Ofgem figures as published · January 2027 cap announced ${record.announcedLabel}`,
    januaryParagraphs: [
      `Ofgem published the cap for 1 January to 31 March 2027 at ${formatted} a year for a typical dual-fuel Direct Debit household on ${record.announcedLabel}.`,
      rates
        ? `That is ${formatCapPounds(rates.changeGbp)} more than the ${currentFormatted} cap in force until 31 December 2026. Ofgem calls this a ${rates.ofgemRisePercent}% rise.`
        : `The cap in force until 31 December 2026 (${CURRENT_PRICE_CAP.periodLabel}) is ${currentFormatted} a year for the same household.`,
      ...(rates ? [rates.context] : []),
    ],
    unpublishedParagraph: null,
    faqs: [
      pendingFaqs()[0]!,
      {
        question: "What is the January 2027 price cap?",
        answer: `${formatted} a year for a typical dual-fuel Direct Debit household (1 January to 31 March 2027), published by Ofgem on ${record.announcedLabel}.${rateSentence}${rise} The cap in force until 31 December 2026 is ${currentFormatted}.${rates ? ` ${rates.vatNote}` : ""}`,
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
    llms: rates
      ? `Ofgem price cap for 1 January to 31 March 2027: ${formatted} a year (typical dual-fuel Direct Debit), announced ${record.announcedLabel}. That is ${formatCapPounds(rates.changeGbp)} more than the ${currentFormatted} cap in force until 31 December 2026. Ofgem calls this a ${rates.ofgemRisePercent}% rise.`
      : `Ofgem price cap for 1 January to 31 March 2027: ${formatted} a year (typical dual-fuel Direct Debit), announced ${record.announcedLabel}. The cap in force until 31 December 2026 is ${currentFormatted}.`,
    rates,
    home: {
      figure: `${formatted} a year`,
      detail: rates
        ? `${formatCapPounds(rates.changeGbp)} more than the ${currentFormatted} cap in force until 31 December 2026. Ofgem calls this a ${rates.ofgemRisePercent}% rise.`
        : `The cap in force until 31 December 2026 is ${currentFormatted}.`,
    },
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

export function priceCapHomeCardCopy(): PriceCapHomeCopy {
  return PRESENTATION.home;
}

export function priceCapRates(): PriceCapRatesView | null {
  return PRESENTATION.rates;
}
