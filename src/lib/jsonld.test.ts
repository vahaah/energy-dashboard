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
import { homepageJsonLd, recordsJsonLd, APP_ID, PERSON_ID } from "@/lib/jsonld";
import { emptyRecordsWithDocumentedCoal } from "@/lib/historic-mix";
import { SITE_ORIGIN } from "@/lib/site";

describe("JSON-LD", () => {
  it("emits WebSite, WebApplication, Dataset downloads and Person on the homepage", () => {
    const graph = homepageJsonLd(null)["@graph"];
    const types = graph.map((node) => node["@type"]);
    expect(types).toEqual(["WebSite", "WebApplication", "Person", "Dataset"]);

    const dataset = graph.find((node) => node["@type"] === "Dataset") as {
      license: Array<{ name: string; url: string }>;
      url: string;
      creditText: string;
      creator: { "@id": string };
      publisher: { "@id": string };
      distribution: Array<{ name: string; contentUrl: string }>;
      variableMeasured: string[];
    };
    expect(dataset.url).toBe(`${SITE_ORIGIN}/`);
    expect(dataset.creditText.startsWith(elexonBmrsAttribution())).toBe(true);
    expect(dataset.license.map((item) => item.url)).toEqual([
      ELEXON_BMRS_LICENCE_URL,
      NESO_OPEN_DATA_LICENCE_URL,
      CC_BY_4_0_LICENSE_URL,
    ]);
    expect(dataset.license.map((item) => item.name).join(" ")).toContain("Elexon BMRS");
    expect(dataset.license).not.toBe(CC_BY_4_0_LICENSE_URL);
    expect(dataset.creator).toEqual({ "@id": APP_ID });
    expect(dataset.publisher).toEqual({ "@id": PERSON_ID });
    expect(dataset.distribution.map((item) => item.name)).toEqual([
      "Snapshots",
      "Generation",
      "Prices and commodities",
    ]);
    expect(dataset.variableMeasured.join(" ")).not.toContain("TTF");
    expect(dataset.variableMeasured.join(" ")).not.toContain("NBP");
    expect(dataset.variableMeasured.join(" ")).not.toContain("JKM");
    expect(dataset.variableMeasured).toContain(COMMODITY_LABELS.eu_natural_gas);
    expect(dataset.variableMeasured).toContain(COMMODITY_LABELS.lng_asia);
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

    const dataset = graph.find((node) => node["@type"] === "Dataset") as {
      license: string;
      creator: { "@id": string };
    };
    expect(dataset.license).toBe(CC_BY_4_0_LICENSE_URL);
    expect(dataset.creator).toEqual({ "@id": APP_ID });

    const list = graph.find((node) => node["@type"] === "ItemList") as {
      itemListElement: Array<{ item: { name: string } }>;
    };
    expect(list.itemListElement.map((item) => item.item.name).join(" ")).not.toContain("solar");
    expect(graph.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
    expect(graph.some((node) => node["@type"] === "FAQPage")).toBe(true);
  });
});
