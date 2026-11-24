import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CC_BY_4_0_LICENSE_URL,
  ELEXON_BMRS_LICENCE_URL,
  elexonBmrsAttribution,
  NESO_OPEN_DATA_LICENCE_URL,
} from "@/lib/attribution";
import { COMMODITY_LABELS } from "@/lib/colors";
import {
  apiDocsJsonLd,
  homepageJsonLd,
  priceCapJsonLd,
  recordsJsonLd,
  todayJsonLd,
  ORGANIZATION_ID,
  datasetOrganisation,
} from "@/lib/jsonld";
import { buildBalancingPage } from "@/lib/balancing/page-model";
import { balancingPageSchema } from "@/lib/balancing/leads";
import { emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";
import { LEGAL_CONTROLLER, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

describe("JSON-LD", () => {
  it("emits WebSite, WebApplication, Dataset downloads and Person on the homepage", () => {
    const graph = homepageJsonLd(null)["@graph"];
    const types = graph.map((node) => node["@type"]);
    expect(types).toEqual(["WebSite", "WebApplication", "Organization", "WebPage", "Person", "Dataset"]);
    expect(JSON.parse(JSON.stringify(homepageJsonLd(null)))["@graph"]).toHaveLength(6);

    const dataset = graph.find((node) => node["@type"] === "Dataset") as {
      license: Array<{ name: string; url: string }>;
      url: string;
      creditText: string;
      creator: { "@type": string; "@id": string; name: string; legalName: string };
      publisher: { "@type": string; "@id": string };
      distribution: Array<{ name: string; contentUrl: string }>;
      variableMeasured: Array<{ name: string }>;
      isBasedOn: Array<{ creditText?: string; description?: string; license?: unknown }>;
    };
    expect(dataset.url).toBe(SITE_ORIGIN);
    expect(dataset.creditText).toBe(
      "Grid (grid.vahaah.com), with upstream attributions listed in isBasedOn",
    );
    expect(dataset.isBasedOn.map((item) => item.creditText).join(" ")).toContain(elexonBmrsAttribution());
    expect(dataset.license.map((item) => item.url)).toEqual([
      ELEXON_BMRS_LICENCE_URL,
      NESO_OPEN_DATA_LICENCE_URL,
      CC_BY_4_0_LICENSE_URL,
    ]);
    expect(dataset.license.map((item) => item.name).join(" ")).toContain("Elexon BMRS");
    expect(dataset.license).not.toBe(CC_BY_4_0_LICENSE_URL);
    expect(dataset.creator).toEqual(datasetOrganisation());
    expect(dataset.creator["@type"]).toBe("Organization");
    expect(dataset.creator["@id"]).toBe(ORGANIZATION_ID);
    expect(dataset.creator.name).toBe(SITE_NAME);
    expect(dataset.creator.legalName).toBe(LEGAL_CONTROLLER);
    expect(dataset.publisher["@type"]).toBe("Organization");
    expect(dataset.isBasedOn.every((item) => typeof item.description === "string" && item.description.length > 0)).toBe(true);
    expect(dataset.isBasedOn.every((item) => item.license != null)).toBe(true);
    expect(dataset.distribution.map((item) => item.name)).toEqual([
      "Snapshots",
      "Generation",
      "Prices and commodities",
    ]);
    const measured = dataset.variableMeasured.map((item) => item.name).join(" ");
    expect(measured).not.toContain("TTF");
    expect(measured).not.toContain("NBP");
    expect(measured).not.toContain("JKM");
    expect(measured).toContain(COMMODITY_LABELS.eu_natural_gas);
    expect(measured).toContain(COMMODITY_LABELS.lng_asia);
    expect(dataset.url).not.toContain("/api");
    expect(readFileSync(resolve(import.meta.dirname, "./jsonld.ts"), "utf8")).not.toContain(
      "elexonBmrsAttribution(2026)"
    );
  });

  it("fixes the records licence and creator and skips solar", () => {
    const graph = recordsJsonLd({
      faqs: [{ question: "Q", answer: "A" }],
      records: {
        ...emptyRecordsWithDocumentedCoal(new Date("2026-10-10T12:00:00.000Z")),
        maxWind: {
          value: 23_880,
          timestampUtc: "2026-03-25T13:30:00.000Z",
          basis: "wind",
        },
      },
    })["@graph"];

    const dataset = graph.find((node) => node["@type"] === "Dataset" && node["name"] === "Great Britain electricity records") as {
      license: string;
      creator: { "@type": string; "@id": string };
      isBasedOn: { description: string; license: string };
    };
    expect(dataset.license).toBe(CC_BY_4_0_LICENSE_URL);
    expect(dataset.creator["@type"]).toBe("Organization");
    expect(dataset.creator["@id"]).toBe(ORGANIZATION_ID);
    expect(dataset.isBasedOn.description.length).toBeGreaterThan(0);
    expect(dataset.isBasedOn.license).toBe(NESO_OPEN_DATA_LICENCE_URL);

    const list = graph.find((node) => node["@type"] === "ItemList") as {
      itemListElement: Array<{ item: { name: string } }>;
    };
    expect(list.itemListElement.map((item) => item.item.name).join(" ")).not.toContain("solar");
    expect(graph.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
    expect(graph.some((node) => node["@type"] === "FAQPage")).toBe(true);
  });

  it("adds breadcrumbs and FAQ on today and price-cap, and Dataset on /api", () => {
    const today = todayJsonLd({
      faqs: [{ question: "Q", answer: "A" }],
      dateModified: "2026-10-10T11:00:00.000Z",
    })["@graph"];
    expect(today.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
    expect(today.some((node) => node["@type"] === "FAQPage")).toBe(true);

    const cap = priceCapJsonLd({ faqs: [{ question: "Q", answer: "A" }] })["@graph"];
    expect(JSON.stringify(cap)).toContain("/explained/price-cap");

    const api = apiDocsJsonLd(null)["@graph"];
    const dataset = api.find((node) => node["@type"] === "Dataset") as {
      url: string;
      creator: { "@type": string };
    };
    expect(dataset.url).toBe(`${SITE_ORIGIN}/api`);
    expect(dataset.creator["@type"]).toBe("Organization");

    const balancing = balancingPageSchema(buildBalancingPage(null, new Date("2026-11-24T12:00:00Z")), [])["@graph"];
    const balancingDataset = balancing.find((node) => node["@type"] === "Dataset") as {
      creator: { "@type": string };
      publisher: { "@type": string };
      isBasedOn: Array<{ description: string; license: string }>;
    };
    expect(balancingDataset.creator["@type"]).toBe("Organization");
    expect(balancingDataset.publisher["@type"]).toBe("Organization");
    expect(balancingDataset.creator["@type"]).not.toBe("WebApplication");
    expect(balancingDataset.isBasedOn.every((item) => item.description.length > 0 && item.license.length > 0)).toBe(true);
  });
});
