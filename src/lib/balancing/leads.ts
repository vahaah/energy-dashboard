import { CC_BY_4_0_LICENSE_URL, ELEXON_BMRS_LICENCE_URL, NESO_OPEN_DATA_ATTRIBUTION, NESO_OPEN_DATA_LICENCE_URL, elexonBmrsAttribution } from "@/lib/attribution";
import { BALANCING_DESCRIPTION, BALANCING_FAQS, BALANCING_TITLE, NESO_DAILY_BALANCING_URL } from "@/lib/balancing/copy";
import { formatBalancingDate, formatMissingDays } from "@/lib/balancing/dates";
import { TYPICAL_HOUSEHOLD_KWH } from "@/lib/balancing/household";
import { formatPounds, formatShare, formatTariff } from "@/lib/balancing/money";
import type { BalancingPageModel } from "@/lib/balancing/page-model";
import { datasetOrganisation, pageJsonLd } from "@/lib/jsonld";
import { SITE_ORIGIN } from "@/lib/site";

export const BALANCING_DATASET_ID = `${SITE_ORIGIN}/system/balancing#dataset`;

export type BalancingFaq = { question: string; answer: string };

export function balancingSummary(model: BalancingPageModel): string {
  if (model.fyPence == null || model.fyThrough == null) {
    return "NESO's daily balancing costs are not available for this period. This is missing data, not zero.";
  }
  const missing = formatMissingDays(model.missingDates);
  const partial = missing ? ` ${missing} The total is partial.` : "";
  const latest =
    model.latest?.provisional === true
      ? `, including ${formatPounds(model.latest.pence)} on ${formatBalancingDate(model.latest.date)} (incomplete: ${model.latest.periods} of ${model.latest.expectedPeriods} half-hours)`
      : "";
  const share =
    model.constraintsShare == null ? "" : ` The Constraints category is ${formatShare(model.constraintsShare)} of that daily file.`;
  const tariff =
    model.tariff == null
      ? ""
      : ` The current final BSUoS tariff is ${formatTariff(model.tariff.gbpPerMwh)} (${formatBalancingDate(model.tariff.from)} to ${formatBalancingDate(model.tariff.to)})`;
  const household =
    model.householdPence != null && model.tariff != null
      ? `, about ${formatPounds(model.householdPence)} a year for Ofgem's typical household (${TYPICAL_HOUSEHOLD_KWH.toLocaleString("en-GB")} kWh). It leaves out network losses. Excluding VAT.`
      : ".";
  return `In financial year ${model.financialYearLabel} to ${formatBalancingDate(model.fyThrough)}, NESO's daily balancing costs sum to ${formatPounds(model.fyPence)}${latest}.${partial}${share}${tariff}${household} A separate estimate of electricity traded with neighbouring countries is below; it is not part of the balancing cost. Sources: NESO daily balancing costs and BSUoS fixed tariffs (${NESO_OPEN_DATA_ATTRIBUTION}); trade estimate from Elexon BMRS (${elexonBmrsAttribution()}).`;
}

export function calendarTradeSentence(model: BalancingPageModel): string | null {
  const trade = model.calendarTrade;
  if (!trade) {
    return null;
  }
  return `Calendar year ${trade.year}: imports ${formatPounds(trade.importPence)}, exports ${formatPounds(trade.exportPence)}, net imports ${formatPounds(trade.netPence)} (estimates). Half-hourly flow × Market index price (Elexon MID). Not an invoice, and not part of the balancing cost.`;
}

export function balancingFaqs(model: BalancingPageModel): BalancingFaq[] {
  return BALANCING_FAQS.map((faq) => ({
    question: faq.question,
    answer: faq.question === "Who pays the balancing cost?" ? whoPaysAnswer(model) : faq.answer,
  }));
}

export function whoPaysAnswer(model: BalancingPageModel): string {
  const base =
    "NESO recovers it through BSUoS (Balancing Services Use of System), a charge in £/MWh that electricity suppliers pay and pass on in bills. NESO sets it each December for the following April to March.";
  if (model.tariff == null || model.householdPence == null) {
    return `${base} NESO puts balancing at 4.3% of a typical household electricity bill in 2025/26.`;
  }
  const tariff = formatTariff(model.tariff.gbpPerMwh);
  return `${base} The current tariff is ${tariff}, about ${formatPounds(model.householdPence)} a year (${tariff} × ${TYPICAL_HOUSEHOLD_KWH.toLocaleString("en-GB")} kWh, Ofgem's typical household from 1 Jul 2026). It leaves out network losses. Excluding VAT. NESO puts balancing at 4.3% of a typical household electricity bill in 2025/26.`;
}

export function balancingLlmsLine(model: BalancingPageModel): string | null {
  if (model.fyPence == null || model.fyThrough == null || model.constraintsShare == null || model.tariff == null || model.householdPence == null) {
    return null;
  }
  const incomplete = model.latest?.provisional ? "; latest day incomplete" : "";
  return `Latest GB balancing costs (NESO daily file, financial year ${model.financialYearLabel} to ${formatBalancingDate(model.fyThrough)}${incomplete}): ${formatPounds(model.fyPence)}, of which the Constraints category ${formatShare(model.constraintsShare)}. Current final BSUoS tariff ${formatTariff(model.tariff.gbpPerMwh)}, about ${formatPounds(model.householdPence)} a year at ${TYPICAL_HOUSEHOLD_KWH.toLocaleString("en-GB")} kWh. It leaves out network losses. Excluding VAT. A separate estimate of electricity traded with neighbouring countries is on the same page and is not part of the balancing cost. Sources: NESO daily balancing costs and BSUoS fixed tariffs; trade estimate from Elexon BMRS.`;
}

export function balancingPageSchema(model: BalancingPageModel, faqs: readonly BalancingFaq[]) {
  return pageJsonLd({
    name: BALANCING_TITLE,
    description: BALANCING_DESCRIPTION,
    url: `${SITE_ORIGIN}/system/balancing`,
    breadcrumbs: [
      { name: "System" },
      { name: "Balancing", item: `${SITE_ORIGIN}/system/balancing` },
    ],
    faqs: [...faqs],
    dateModified: model.generatedAt ?? undefined,
    mainEntityId: BALANCING_DATASET_ID,
    extra: [datasetOrganisation(), balancingDatasetNode(model)],
  });
}

function balancingDatasetNode(model: BalancingPageModel): Record<string, unknown> {
  return {
    "@type": "Dataset",
    "@id": BALANCING_DATASET_ID,
    name: "GB electricity balancing costs, BSUoS tariffs and estimated interconnector trade value",
    description:
      "Daily NESO balancing costs in six categories from financial year 2017/18, current and draft BSUoS fixed tariffs, and a separate estimate of electricity traded with neighbouring countries (Elexon interconnector flow × Market index price).",
    url: `${SITE_ORIGIN}/system/balancing`,
    variableMeasured: [
      { "@type": "PropertyValue", name: "Balancing cost", unitText: "GBP" },
      { "@type": "PropertyValue", name: "BSUoS tariff", unitText: "GBP/MWh" },
      { "@type": "PropertyValue", name: "Estimated trade value", unitText: "GBP" },
    ],
    temporalCoverage: "2017-04-01/..",
    spatialCoverage: {
      "@type": "Place",
      name: "Great Britain",
      geo: { "@type": "GeoShape", box: "49.8 -8.7 60.9 1.8" },
    },
    license: CC_BY_4_0_LICENSE_URL,
    creditText: "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
    creator: datasetOrganisation(),
    publisher: datasetOrganisation(),
    isAccessibleForFree: true,
    inLanguage: "en-GB",
    ...(model.generatedAt ? { dateModified: model.generatedAt } : {}),
    isBasedOn: [
      {
        "@type": "Dataset",
        name: "NESO Daily Balancing Costs and BSUoS Fixed Tariffs",
        url: NESO_DAILY_BALANCING_URL,
        description: "Daily balancing costs and BSUoS fixed tariffs published by the National Energy System Operator.",
        creditText: NESO_OPEN_DATA_ATTRIBUTION,
        license: NESO_OPEN_DATA_LICENCE_URL,
      },
      {
        "@type": "Dataset",
        name: "Elexon BMRS / Insights",
        url: ELEXON_BMRS_LICENCE_URL,
        description: "Half-hourly GB electricity generation, demand and prices from the Balancing Mechanism Reporting Service.",
        creditText: elexonBmrsAttribution(),
        license: ELEXON_BMRS_LICENCE_URL,
      },
    ],
  };
}
