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
    expected_cadence: "P1D",
  },
] as const satisfies readonly CatalogueMetricRef[];

const ITSDO_METRIC = [
  {
    metric_id: "elec.gb.demand.itsdo",
    dataset_id: "ITSDO",
    source_id: "elexon-bmrs",
    expected_cadence: "PT30M",
  },
] as const satisfies readonly CatalogueMetricRef[];

const PARTIAL = { fullRegistry: false } as const;

describe("publish-check", () => {
  it("accepts the checked-in catalogue", () => {
    expect(CATALOGUE_SOURCE_IDS).toEqual(DATA_SOURCE_IDS);
    expect(checkCatalogue(catalogueRoot())).toEqual({ ok: true, errors: [] });
  });

  it("fails when a source has no licence", () => {
    const result = checkCatalogue(resolve(FIXTURES, "missing-licence"), { ...PARTIAL, metrics: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/licence_url/);
  });

  it("fails when a dataset points at a source that is not in the catalogue", () => {
    const result = checkCatalogue(resolve(FIXTURES, "dangling-reference"), {
      ...PARTIAL,
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
    const options = { ...PARTIAL, metrics: GAS_METRIC };
    expect(checkCatalogue(baselineDir, options)).toEqual({ ok: true, errors: [] });
    expect(checkCatalogue(candidateDir, options)).toEqual({ ok: true, errors: [] });
    const mutated = checkCatalogue(candidateDir, { ...options, baselineDir });
    expect(mutated).toEqual({
      ok: false,
      errors: ["source_release_id national-gas:PUBOB603:2026-01-15T00:00:00.000Z is not the committed line"],
    });
  });

  it("fails when an existing release line is reordered", () => {
    const baselineDir = resolve(FIXTURES, "reordered-release/baseline");
    const candidateDir = resolve(FIXTURES, "reordered-release/candidate");
    const options = { ...PARTIAL, metrics: GAS_METRIC };
    expect(checkCatalogue(baselineDir, options)).toEqual({ ok: true, errors: [] });
    expect(checkCatalogue(candidateDir, options)).toEqual({ ok: true, errors: [] });
    const reordered = checkCatalogue(candidateDir, { ...options, baselineDir });
    expect(reordered).toEqual({
      ok: false,
      errors: [
        "source_release_id national-gas:PUBOB603:sha256:ada2a7e7ad06c2635897689f51e1582cb322e4688c76365b729bebdcfa5663bb is not the committed line",
      ],
    });
  });

  it("fails when a run's release belongs to another dataset", () => {
    const result = checkCatalogue(resolve(FIXTURES, "run-wrong-dataset"), {
      ...PARTIAL,
      metrics: [...ITSDO_METRIC, ...GAS_METRIC],
    });
    expect(result).toEqual({
      ok: false,
      errors: [
        "ingestion run run-itsdo release national-gas:PUBOB603:sha256:04a9ea2dd3a938dffdb0b8ce8f9d4ad37216a67b193209d521cb364f30db33be belongs to national-gas:PUBOB603, not elexon-bmrs:ITSDO",
      ],
    });
  });

  it("fails when dataset cadence matches no metric expected_cadence", () => {
    const result = checkCatalogue(resolve(FIXTURES, "wrong-cadence"), {
      ...PARTIAL,
      metrics: GAS_METRIC,
    });
    expect(result).toEqual({
      ok: false,
      errors: ["national-gas:PUBOB603: cadence PT1H does not match expected_cadence P1D"],
    });
  });

  it("fails on an impossible UTC instant", () => {
    const result = checkCatalogue(resolve(FIXTURES, "impossible-instant"), { ...PARTIAL, metrics: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/real UTC instant/);
  });

  it("accepts a second extract of the same dataset when the hash covers that extract", () => {
    expect(
      checkCatalogue(resolve(FIXTURES, "second-extract"), { ...PARTIAL, metrics: GAS_METRIC }),
    ).toEqual({ ok: true, errors: [] });
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
