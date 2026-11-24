import {
  CC_BY_4_0_LICENSE_URL,
  CARBON_INTENSITY_API_URL,
  CARBON_INTENSITY_ATTRIBUTION,
  EIA_ATTRIBUTION,
  EIA_LICENCE,
  EIA_URL,
  ELEXON_BMRS_LICENCE_URL,
  elexonBmrsAttribution,
  NATIONAL_GAS_ATTRIBUTION,
  NATIONAL_GAS_LICENCE,
  NATIONAL_GAS_PORTAL_URL,
  NESO_HISTORIC_MIX_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  PV_LIVE_ATTRIBUTION,
  PV_LIVE_LICENCE,
  PV_LIVE_URL,
  WORLD_BANK_PINK_SHEET_ATTRIBUTION,
  WORLD_BANK_PINK_SHEET_LICENCE_URL,
  WORLD_BANK_PINK_SHEET_URL,
} from "@/lib/attribution";
import { COMMODITY_LABELS } from "@/lib/colors";
import { utcIsoFromTimestamp } from "@/lib/london-time";
import {
  API_DOCS_DESCRIPTION,
  API_DOCS_TITLE,
  DATASET_TEMPORAL_COVERAGE_START,
  GAS_DESCRIPTION,
  GAS_TITLE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  LEGAL_CONTROLLER,
  METHODOLOGY_DESCRIPTION,
  METHODOLOGY_TITLE,
  PRICE_CAP_DESCRIPTION,
  PRICE_CAP_TITLE,
  RECORDS_DESCRIPTION,
  RECORDS_TITLE,
  SITE_NAME,
  SITE_ORIGIN,
  TODAY_DESCRIPTION,
  TODAY_TITLE,
} from "@/lib/site";
import type { LatestFacts } from "@/lib/facts";
import type { GridRecords, HistoricRecordPoint } from "@/lib/historic-mix";

export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const APP_ID = `${SITE_ORIGIN}/#app`;
export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const DATASET_ID = `${SITE_ORIGIN}/#dataset`;
export const PERSON_ID = "https://vahaah.com/#person";

type JsonLdNode = Record<string, unknown>;

/** Publisher and creator for Dataset nodes. Organization, not the WebApplication. */
export function datasetOrganisation(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    legalName: LEGAL_CONTROLLER,
    url: SITE_ORIGIN,
  };
}

export function homepageJsonLd(facts: LatestFacts | null): {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
} {
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteNode(),
      webApplicationNode(),
      datasetOrganisation(),
      webPageNode({
        name: HOME_TITLE,
        description: HOME_DESCRIPTION,
        url: SITE_ORIGIN,
        id: `${SITE_ORIGIN}/#webpage`,
        dateModified: utcIsoFromTimestamp(facts?.referenceTimestamp),
      }),
      personNode(),
      datasetNode(facts),
    ],
  };
}

export function recordsJsonLd(input: {
  faqs: Array<{ question: string; answer: string }>;
  records: GridRecords;
}): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
  return {
    "@context": "https://schema.org",
    "@graph": [
      webPageNode({
        name: RECORDS_TITLE,
        description: RECORDS_DESCRIPTION,
        url: `${SITE_ORIGIN}/records`,
        id: `${SITE_ORIGIN}/records#webpage`,
      }),
      datasetOrganisation(),
      recordsDatasetNode(),
      recordsItemListNode(input.records),
      breadcrumbNode({ name: "Records", item: `${SITE_ORIGIN}/records` }),
      faqPageNode(input.faqs, `${SITE_ORIGIN}/records#faq`),
    ],
  };
}

function webPageNode(input: {
  name: string;
  description: string;
  url: string;
  id: string;
  dateModified?: string | null;
  breadcrumbId?: string;
  mainEntityId?: string;
}): JsonLdNode {
  return {
    "@type": "WebPage",
    "@id": input.id,
    url: input.url,
    name: input.name,
    description: input.description,
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: "en-GB",
    publisher: { "@id": APP_ID },
    author: { "@id": PERSON_ID },
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.breadcrumbId ? { breadcrumb: { "@id": input.breadcrumbId } } : {}),
    ...(input.mainEntityId ? { mainEntity: { "@id": input.mainEntityId } } : {}),
  };
}

function measured(name: string, unitText: string): JsonLdNode {
  return { "@type": "PropertyValue", name, unitText };
}

function citedDataset(input: {
  name: string;
  url: string;
  description: string;
  creditText: string;
  license?: string | JsonLdNode;
}): JsonLdNode {
  return {
    "@type": "Dataset",
    name: input.name,
    url: input.url,
    description: input.description,
    creditText: input.creditText,
    ...(input.license ? { license: input.license } : {}),
  };
}

function licenceText(name: string): JsonLdNode {
  return { "@type": "CreativeWork", name };
}

function homepageSources(): JsonLdNode[] {
  return [
    citedDataset({
      name: "Elexon BMRS / Insights",
      url: "https://www.elexon.co.uk/data/balancing-mechanism-reporting-agent/",
      description: "Half-hourly GB electricity generation, demand and prices from the Balancing Mechanism Reporting Service.",
      creditText: elexonBmrsAttribution(),
      license: ELEXON_BMRS_LICENCE_URL,
    }),
    citedDataset({
      name: "NESO Data Portal",
      url: "https://www.neso.energy/data-portal",
      description: "Open data from the National Energy System Operator, including embedded wind and historic generation.",
      creditText: NESO_OPEN_DATA_ATTRIBUTION,
      license: NESO_OPEN_DATA_LICENCE_URL,
    }),
    citedDataset({
      name: "NESO Carbon Intensity API",
      url: CARBON_INTENSITY_API_URL,
      description: "National carbon intensity of electricity in Great Britain, in grams of CO₂ per kilowatt-hour.",
      creditText: CARBON_INTENSITY_ATTRIBUTION,
      license: CC_BY_4_0_LICENSE_URL,
    }),
    citedDataset({
      name: "Sheffield Solar PV_Live",
      url: PV_LIVE_URL,
      description: "GB solar generation estimates, including embedded solar, from Sheffield Solar PV_Live.",
      creditText: PV_LIVE_ATTRIBUTION,
      license: licenceText(PV_LIVE_LICENCE),
    }),
    citedDataset({
      name: "National Gas Transmission Data Portal",
      url: NATIONAL_GAS_PORTAL_URL,
      description: "GB gas System Average Price and National Transmission System operational data.",
      creditText: NATIONAL_GAS_ATTRIBUTION,
      license: licenceText(NATIONAL_GAS_LICENCE),
    }),
    citedDataset({
      name: "U.S. Energy Information Administration",
      url: EIA_URL,
      description: "Brent, WTI and Henry Hub prices from the U.S. Energy Information Administration.",
      creditText: EIA_ATTRIBUTION,
      license: licenceText(EIA_LICENCE),
    }),
    citedDataset({
      name: "World Bank Commodity Price Data (The Pink Sheet)",
      url: WORLD_BANK_PINK_SHEET_URL,
      description: "Monthly European natural gas and Japan LNG prices from the World Bank Pink Sheet.",
      creditText: WORLD_BANK_PINK_SHEET_ATTRIBUTION,
      license: WORLD_BANK_PINK_SHEET_LICENCE_URL,
    }),
  ];
}

function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_ORIGIN,
    name: SITE_NAME,
    description: "Free view of Great Britain's electricity and gas system, updated hourly from public data.",
    inLanguage: "en-GB",
    publisher: { "@id": APP_ID },
    creator: { "@id": PERSON_ID },
  };
}

function webApplicationNode(): JsonLdNode {
  return {
    "@type": "WebApplication",
    "@id": APP_ID,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    applicationCategory: "ReferenceApplication",
    operatingSystem: "Any (web browser)",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    creator: { "@id": PERSON_ID },
    inLanguage: "en-GB",
  };
}

function personNode(): JsonLdNode {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Alex Vakhitov",
    url: "https://vahaah.com/",
  };
}

export function datasetNode(facts: LatestFacts | null, url = SITE_ORIGIN): JsonLdNode {
  const dateModified = utcIsoFromTimestamp(facts?.referenceTimestamp);

  return {
    "@type": "Dataset",
    "@id": DATASET_ID,
    name: "Great Britain electricity generation, demand, carbon intensity and prices (half-hourly)",
    description:
      "Half-hourly GB generation by fuel, demand, interconnector flows, carbon intensity and market prices, with gas and oil prices for context. Updated hourly.",
    url,
    license: homepageDatasetLicenses(),
    isAccessibleForFree: true,
    creator: datasetOrganisation(),
    publisher: datasetOrganisation(),
    inLanguage: "en-GB",
    spatialCoverage: {
      "@type": "Place",
      name: "Great Britain",
      geo: { "@type": "GeoShape", box: "49.8 -8.7 60.9 1.8" },
    },
    temporalCoverage: `${DATASET_TEMPORAL_COVERAGE_START}/..`,
    variableMeasured: [
      measured("Generation by fuel", "MW"),
      measured("Demand", "MW"),
      measured("Interconnector flow", "MW"),
      measured("Carbon intensity", "gCO2/kWh"),
      measured("Market index price", "GBP/MWh"),
      measured("System (imbalance) price", "GBP/MWh"),
      measured("GB gas System Average Price", "p/kWh"),
      measured(COMMODITY_LABELS.eu_natural_gas, "USD"),
      measured("Brent", "USD"),
      measured("WTI", "USD"),
      measured("Henry Hub", "USD"),
      measured(COMMODITY_LABELS.lng_asia, "USD"),
    ],
    isBasedOn: homepageSources(),
    creditText: "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
    ...(dateModified ? { dateModified } : {}),
    distribution: [
      {
        "@type": "DataDownload",
        name: "Snapshots",
        encodingFormat: "application/json",
        contentUrl: `${SITE_ORIGIN}/api/snapshots?range=24h`,
      },
      {
        "@type": "DataDownload",
        name: "Generation",
        encodingFormat: "application/json",
        contentUrl: `${SITE_ORIGIN}/api/generation?range=24h`,
      },
      {
        "@type": "DataDownload",
        name: "Prices and commodities",
        encodingFormat: "application/json",
        contentUrl: `${SITE_ORIGIN}/api/prices?range=90d`,
      },
    ],
  };
}

function homepageDatasetLicenses(): JsonLdNode[] {
  return [
    {
      "@type": "CreativeWork",
      name: "Elexon BMRS licence",
      url: ELEXON_BMRS_LICENCE_URL,
    },
    {
      "@type": "CreativeWork",
      name: "NESO Open Data licence",
      url: NESO_OPEN_DATA_LICENCE_URL,
    },
    {
      "@type": "CreativeWork",
      name: "Carbon Intensity API (CC BY 4.0)",
      url: CC_BY_4_0_LICENSE_URL,
    },
  ];
}

function recordsDatasetNode(): JsonLdNode {
  return {
    "@type": "Dataset",
    name: "Great Britain electricity records",
    description:
      "Derived records from NESO historic generation mix and carbon intensity: wind, carbon, coal and wind milestones, since Grid's records began.",
    license: CC_BY_4_0_LICENSE_URL,
    creator: datasetOrganisation(),
    publisher: datasetOrganisation(),
    temporalCoverage: "2009-01-01/..",
    spatialCoverage: "Great Britain",
    url: `${SITE_ORIGIN}/records`,
    isBasedOn: citedDataset({
      name: "NESO Historic Generation Mix",
      url: NESO_HISTORIC_MIX_URL,
      description: "Historic GB generation mix and carbon intensity published by the National Energy System Operator.",
      creditText: NESO_OPEN_DATA_ATTRIBUTION,
      license: NESO_OPEN_DATA_LICENCE_URL,
    }),
    variableMeasured: ["Wind generation", "Carbon intensity", "Coal generation"],
    creditText: "Supported by National Energy SO Open Data",
  };
}

export function breadcrumbNode(...crumbs: Array<{ name: string; item?: string }>): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_ORIGIN },
      ...crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: crumb.name,
        ...(crumb.item ? { item: crumb.item } : {}),
      })),
    ],
  };
}

export function faqPageNode(
  faqs: Array<{ question: string; answer: string }>,
  id?: string,
): JsonLdNode {
  return {
    "@type": "FAQPage",
    ...(id ? { "@id": id } : {}),
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function pageJsonLd(input: {
  name: string;
  description: string;
  url: string;
  breadcrumbs: Array<{ name: string; item?: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  extra?: JsonLdNode[];
  dateModified?: string;
  mainEntityId?: string;
}): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
  const breadcrumb = breadcrumbNode(...input.breadcrumbs);
  const breadcrumbId = `${input.url}#breadcrumb`;
  breadcrumb["@id"] = breadcrumbId;
  const graph: JsonLdNode[] = [
    webPageNode({
      name: input.name,
      description: input.description,
      url: input.url,
      id: `${input.url}#webpage`,
      dateModified: input.dateModified,
      breadcrumbId: input.mainEntityId ? breadcrumbId : undefined,
      mainEntityId: input.mainEntityId,
    }),
    breadcrumb,
  ];
  if (input.faqs && input.faqs.length > 0) {
    graph.push(faqPageNode(input.faqs, `${input.url}#faq`));
  }
  if (input.extra) {
    graph.push(...input.extra);
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function todayJsonLd(input: {
  faqs: Array<{ question: string; answer: string }>;
  dateModified?: string;
}): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
  return pageJsonLd({
    name: TODAY_TITLE,
    description: TODAY_DESCRIPTION,
    url: `${SITE_ORIGIN}/today`,
    breadcrumbs: [{ name: "Today", item: `${SITE_ORIGIN}/today` }],
    faqs: input.faqs,
    dateModified: input.dateModified,
  });
}

export function priceCapJsonLd(input: {
  faqs: Array<{ question: string; answer: string }>;
}): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
  return pageJsonLd({
    name: PRICE_CAP_TITLE,
    description: PRICE_CAP_DESCRIPTION,
    url: `${SITE_ORIGIN}/explained/price-cap`,
    breadcrumbs: [{ name: "Price cap", item: `${SITE_ORIGIN}/explained/price-cap` }],
    faqs: input.faqs,
  });
}

export function gasJsonLd(input: {
  faqs: Array<{ question: string; answer: string }>;
  dateModified?: string;
}): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
  return pageJsonLd({
    name: GAS_TITLE,
    description: GAS_DESCRIPTION,
    url: `${SITE_ORIGIN}/prices/gas`,
    breadcrumbs: [{ name: "Gas price", item: `${SITE_ORIGIN}/prices/gas` }],
    faqs: input.faqs,
    dateModified: input.dateModified,
  });
}

export function methodologyJsonLd(input: {
  faqs: Array<{ question: string; answer: string }>;
}): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
  return pageJsonLd({
    name: METHODOLOGY_TITLE,
    description: METHODOLOGY_DESCRIPTION,
    url: `${SITE_ORIGIN}/methodology`,
    breadcrumbs: [{ name: "Methodology", item: `${SITE_ORIGIN}/methodology` }],
    faqs: input.faqs,
  });
}

export function apiDocsJsonLd(facts: LatestFacts | null): {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
} {
  return pageJsonLd({
    name: API_DOCS_TITLE,
    description: API_DOCS_DESCRIPTION,
    url: `${SITE_ORIGIN}/api`,
    breadcrumbs: [{ name: "API", item: `${SITE_ORIGIN}/api` }],
    extra: [datasetOrganisation(), datasetNode(facts, `${SITE_ORIGIN}/api`)],
  });
}

function recordsItemListNode(records: GridRecords): JsonLdNode {
  const items: JsonLdNode[] = [];
  pushObservation(items, "Highest wind since Grid's records began", records.maxWind, "GW", 1000);
  pushObservation(
    items,
    "Lowest carbon since Grid's records began",
    records.lowestCarbon,
    "gCO₂/kWh",
    1
  );
  pushObservation(
    items,
    "Highest renewable share since Grid's records began",
    records.highestRenewableShare,
    "%",
    1
  );
  pushObservation(
    items,
    "Highest zero-carbon share since Grid's records began",
    records.highestZeroCarbonShare,
    "%",
    1
  );

  return {
    "@type": "ItemList",
    name: "GB electricity records since Grid's records began",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item,
    })),
  };
}

function pushObservation(
  items: JsonLdNode[],
  name: string,
  record: HistoricRecordPoint | null,
  unitText: string,
  divisor: number
): void {
  if (!record) {
    return;
  }

  items.push({
    "@type": "Observation",
    name,
    observationDate: utcIsoFromTimestamp(record.timestampUtc),
    value: {
      "@type": "QuantitativeValue",
      value: Number((record.value / divisor).toFixed(1)),
      unitText,
    },
  });
}
