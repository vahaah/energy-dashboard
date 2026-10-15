import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DATA_SOURCE_IDS, elexonBmrsAttribution, OGL_V3_ATTRIBUTION, OGL_V3_LICENCE_URL } from "@/lib/attribution";
import { checkCatalogue, type CatalogueMetricRef } from "@/lib/catalogue/check";
import { checkLayerCatalogue } from "@/lib/catalogue/layers-check";
import { DNO_ATTRIBUTION, NESO_DNO_ACCURACY_WARNING, osBasemapAttribution } from "@/lib/map/constants";
import { cataloguePageSources, dataSources, sourceRefreshLabel } from "@/lib/catalogue/page-sources";
import { checkNationalGasSpike } from "@/lib/ingest/national-gas/check";
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
    const layers = JSON.parse(readFileSync(resolve(catalogueRoot(), "layers.json"), "utf8")) as Array<{
      id: string;
      attribution: string;
      accuracy_warning: string | null;
      default_visible: boolean;
    }>;
    const dno = layers.find((layer) => layer.id === "dno");
    expect(dno?.attribution).toBe(DNO_ATTRIBUTION);
    expect(dno?.attribution).toContain("Open Government Licence v3.0");
    expect(dno?.accuracy_warning).toBe(NESO_DNO_ACCURACY_WARNING);
    expect(dno?.accuracy_warning).toContain("not 100% accurate");
    expect(dno?.default_visible).toBe(false);
    expect(osBasemapAttribution(2026)).toBe("Contains OS data © Crown copyright and database right 2026");
  });

  it("fails a DNO layer that drops the NESO attribution", () => {
    const result = checkLayerCatalogue(resolve(FIXTURES, "bad-layer"), { required: true });
    expect(result.join("\n")).toMatch(/attribution/);
    expect(result.join("\n")).toMatch(/default_visible must be false/);
    expect(result.join("\n")).toMatch(/accuracy_warning/);
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

  it("fails when an asset dataset has no register files", () => {
    const result = checkCatalogue(resolve(FIXTURES, "missing-asset-register"), { ...PARTIAL, metrics: [] });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing assets.ndjson");
    expect(result.errors).toContain("missing capacity_records.ndjson");
    expect(result.errors).toContain("missing asset_matches.ndjson");
  });

  it("rejects a synthetic National Gas publication", () => {
    const dir = mkdtempSync(join(tmpdir(), "gas-spike-"));
    const gas = join(dir, "gas");
    const fixtures = join(dir, "csv");
    mkdirSync(gas);
    mkdirSync(fixtures);
    writeFileSync(
      join(gas, "catalogue.json"),
      JSON.stringify({
        sha256: `sha256:${"ab".repeat(32)}`,
        catalogueVersion: "synthetic",
        lastChangeDate: "01-01-2020",
        rows: [
          {
            name: "Synthetic",
            parent: "Synthetic",
            frequency: "Daily",
            publicationTime: "12:00",
            unitOfMeasure: "mscm",
            timeFrame: "",
            status: "Existing",
            statusChangeDate: "2020-01-01",
            statusChangeDescription: "synthetic",
            publicationId: "PUBSYNTH",
            description: "synthetic",
          },
        ],
      }),
    );
    writeFileSync(join(gas, "date-format.json"), "{}");
    writeFileSync(join(gas, "instantaneous-flow.json"), "{}");
    writeFileSync(
      join(fixtures, "PUBSYNTH.csv"),
      [
        "# publication_id: PUBSYNTH",
        "# catalogue_version: synthetic",
        "# unit: mscm",
        "# quantity_kind: banana",
        "# gas_day: none",
        "# null_behaviour: treat blank as zero",
        "Applicable At,Applicable For,Data Item,Value,Generated Time,Quality Indicator",
        "",
      ].join("\n"),
    );
    const errors = checkNationalGasSpike(gas, fixtures, join(dir, "missing-release.json"));
    expect(errors.join("\n")).toMatch(/PUBSYNTH/);
    expect(errors.join("\n")).toMatch(/sha256/);
    rmSync(dir, { recursive: true, force: true });
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
    for (const id of ["desnz-repd", "desnz-dukes", "neso-dno-areas", "os-open-zoomstack"] as const) {
      const source = sources.find((item) => item.id === id);
      expect(source?.licenceUrl).toBe(OGL_V3_LICENCE_URL);
    }
    for (const id of ["desnz-repd", "desnz-dukes"] as const) {
      const source = sources.find((item) => item.id === id);
      expect(source?.attribution).toBe(OGL_V3_ATTRIBUTION);
    }
    expect(sourceRefreshLabel("desnz-repd")).toBe("Quarterly");
    expect(sourceRefreshLabel("desnz-dukes")).toBe("Annual");
    expect(sourceRefreshLabel("elexon-bmrs")).toBe("Hourly");
    expect(sourceRefreshLabel("national-gas")).toBe("Hourly");
    expect(sourceRefreshLabel("eia")).toBe("Every 6 hours");
    expect(sourceRefreshLabel("neso-dno-areas")).toBe("Daily");
    expect(sourceRefreshLabel("os-open-zoomstack")).toBe("Twice a year");
    expect(page).not.toMatch(/OilPriceAPI|\bTTF\b/);
  });
});
