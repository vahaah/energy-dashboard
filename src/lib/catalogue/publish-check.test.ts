import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_SOURCE_IDS, elexonBmrsAttribution } from "@/lib/attribution";
import { checkCatalogue, type CatalogueMetricRef } from "@/lib/catalogue/check";
import { cataloguePageSources, dataSources } from "@/lib/catalogue/page-sources";
import { catalogueRoot } from "@/lib/catalogue/publish-check";
import { CATALOGUE_SOURCE_IDS } from "@/lib/catalogue/schema";

const FIXTURES = resolve(process.cwd(), "src/lib/catalogue/fixtures");

const GAS_METRIC = [
  {
    metric_id: "commodity.gb_gas_sap.price",
    dataset_id: "PUBOB603",
    source_id: "national-gas",
  },
] as const satisfies readonly CatalogueMetricRef[];

const ITSDO_METRIC = [
  {
    metric_id: "elec.gb.demand.itsdo",
    dataset_id: "ITSDO",
    source_id: "elexon-bmrs",
  },
] as const satisfies readonly CatalogueMetricRef[];

describe("publish-check", () => {
  it("accepts the checked-in catalogue", () => {
    expect(CATALOGUE_SOURCE_IDS).toEqual(DATA_SOURCE_IDS);
    expect(checkCatalogue(catalogueRoot())).toEqual({ ok: true, errors: [] });
  });

  it("fails when a source has no licence", () => {
    const result = checkCatalogue(resolve(FIXTURES, "missing-licence"), { fullRegistry: false, metrics: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/licence_url/);
  });

  it("fails when a dataset points at a source that is not in the catalogue", () => {
    const result = checkCatalogue(resolve(FIXTURES, "dangling-reference"), {
      fullRegistry: false,
      metrics: ITSDO_METRIC,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "dangling reference: dataset elexon-bmrs:ITSDO points at missing source elexon-bmrs",
    ]);
  });

  it("fails when an existing release id changes content", () => {
    const baselineDir = resolve(FIXTURES, "mutated-release/baseline");
    const candidateDir = resolve(FIXTURES, "mutated-release/candidate");
    const options = { fullRegistry: false, metrics: GAS_METRIC };
    expect(checkCatalogue(baselineDir, options)).toEqual({ ok: true, errors: [] });
    expect(checkCatalogue(candidateDir, options)).toEqual({ ok: true, errors: [] });
    const mutated = checkCatalogue(candidateDir, { ...options, baselineDir });
    expect(mutated).toEqual({
      ok: false,
      errors: ["source_release_id national-gas:PUBOB603:2026-01-15T00:00:00.000Z changed content"],
    });
  });
});

describe("data-sources catalogue", () => {
  it("renders the checked-in source list, including the National Gas portal credit", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/data-sources/page.tsx"), "utf8");
    expect(page).toContain("cataloguePageSources()");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain(
      "Every feed Grid republishes, with the licence it is under and the attribution text that licence requires.",
    );
    const sources = cataloguePageSources();
    expect(sources.map((source) => source.id)).toEqual([...DATA_SOURCE_IDS]);
    expect(sources.find((source) => source.id === "national-gas")?.attribution).toBe(
      "Data sourced from the National Gas Transmission Data Portal.",
    );
    expect(sources.find((source) => source.id === "elexon-bmrs")?.attribution).toBe(
      elexonBmrsAttribution(2026),
    );
    for (const source of sources) {
      expect(source.licence.trim().length).toBeGreaterThan(0);
      expect(source.licenceUrl).toMatch(/^https:\/\//);
      expect(source.attribution.trim().length).toBeGreaterThan(0);
    }
    expect(dataSources(2026)).toEqual(sources);
  });
});
