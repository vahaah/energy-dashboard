import {
  CC_BY_4_0_LICENSE_URL,
  ELEXON_BMRS_LICENCE_URL,
  elexonBmrsAttribution,
  NESO_HISTORIC_MIX_URL,
  NESO_OPEN_DATA_LICENCE_URL,
} from "@/lib/attribution";
import { COMMODITY_LABELS } from "@/lib/colors";
import { parseUtcDateTime } from "@/lib/london-time";
import {
  DATASET_TEMPORAL_COVERAGE_START,
  SITE_NAME,
  SITE_ORIGIN,
} from "@/lib/site";
import type { LatestFacts } from "@/lib/facts";
import type { GridRecords, HistoricRecordPoint } from "@/lib/historic-mix";

export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const APP_ID = `${SITE_ORIGIN}/#app`;
export const DATASET_ID = `${SITE_ORIGIN}/#dataset`;
export const PERSON_ID = "https://vahaah.com/#person";

type JsonLdNode = Record<string, unknown>;

export function homepageJsonLd(facts: LatestFacts | null): {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
} {
  return {
    "@context": "https://schema.org",
    "@graph": [websiteNode(), webApplicationNode(), personNode(), datasetNode(facts)],
  };
}

export function recordsJsonLd(input: {
  faqs: Array<{ question: string; answer: string }>;
  records: GridRecords;
}): { "@context": "https://schema.org"; "@graph": JsonLdNode[] } {
  return {
    "@context": "https://schema.org",
    "@graph": [
      recordsDatasetNode(),
      recordsItemListNode(input.records),
      breadcrumbNode("Records", `${SITE_ORIGIN}/records`),
      {
        "@type": "FAQPage",
        mainEntity: input.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };
}

function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_ORIGIN}/`,
    name: SITE_NAME,
    description: "Free view of Britain's electricity system, updated hourly from public data.",
    inLanguage: "en-GB",
    publisher: { "@id": PERSON_ID },
  };
}

function webApplicationNode(): JsonLdNode {
  return {
    "@type": "WebApplication",
    "@id": APP_ID,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    applicationCategory: "ReferenceApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    author: { "@id": PERSON_ID },
    creator: { "@id": PERSON_ID },
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

function datasetNode(facts: LatestFacts | null): JsonLdNode {
  const dateModified = facts?.referenceTimestamp
    ? parseUtcDateTime(facts.referenceTimestamp).toISOString()
    : undefined;

  return {
    "@type": "Dataset",
    "@id": DATASET_ID,
    name: "Grid: Great Britain electricity data, hourly",
    description:
      "Half-hourly Great Britain carbon intensity, generation mix by fuel (MW and %), demand, interconnector flows, market index and imbalance prices, and daily gas and oil benchmarks, compiled by Grid from public sources.",
    url: `${SITE_ORIGIN}/`,
    license: homepageDatasetLicenses(),
    isAccessibleForFree: true,
    creator: { "@id": APP_ID },
    publisher: { "@id": PERSON_ID },
    spatialCoverage: { "@type": "Place", name: "Great Britain" },
    temporalCoverage: `${DATASET_TEMPORAL_COVERAGE_START}/..`,
    variableMeasured: [
      "Carbon intensity (gCO2/kWh)",
      "Generation by fuel (MW)",
      "Demand (MW)",
      "Interconnector flow (MW)",
      "Market index price (GBP/MWh)",
      "System price (GBP/MWh)",
      "GB gas System Average Price",
      COMMODITY_LABELS.eu_natural_gas,
      "Brent",
      "WTI",
      "Henry Hub",
      COMMODITY_LABELS.lng_asia,
    ],
    isBasedOn: [
      "https://bmrs.elexon.co.uk/",
      "https://www.neso.energy/data-portal",
      "https://carbonintensity.org.uk/",
      "https://www.solar.sheffield.ac.uk/pvlive/",
      "https://www.eia.gov/",
      "https://www.worldbank.org/en/research/commodity-markets",
      "https://www.nationalgas.com/",
    ],
    creditText: `${elexonBmrsAttribution()} Supported by National Energy SO Open Data. Carbon Intensity API (CC BY 4.0). World Bank Pink Sheet (CC BY 4.0).`,
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
    creator: { "@id": APP_ID },
    temporalCoverage: "2009-01-01/..",
    spatialCoverage: "Great Britain",
    url: `${SITE_ORIGIN}/records`,
    isBasedOn: NESO_HISTORIC_MIX_URL,
    variableMeasured: ["Wind generation", "Carbon intensity", "Coal generation"],
    creditText: "Supported by National Energy SO Open Data",
  };
}

function breadcrumbNode(name: string, item: string): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name, item },
    ],
  };
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
    observationDate: parseUtcDateTime(record.timestampUtc).toISOString(),
    value: {
      "@type": "QuantitativeValue",
      value: Number((record.value / divisor).toFixed(1)),
      unitText,
    },
  });
}
