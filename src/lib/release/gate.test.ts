import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";
import { NATIONAL_GAS_ATTRIBUTION, OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { NOT_AVAILABLE } from "@/lib/assets/labels";
import { assetPageModel } from "@/lib/assets/page-model";
import { mapViewParsers } from "@/lib/assets/params";
import { matchingAssets } from "@/lib/assets/query";
import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import { gasReadingsFromReleases } from "@/lib/data-health";
import { gasReleaseSchema, type GasRelease } from "@/lib/ingest/national-gas/release";
import { DNO_ATTRIBUTION, NESO_DNO_ACCURACY_WARNING, osBasemapAttribution } from "@/lib/map/constants";
import { GAS_METRICS, type GasMetricId } from "@/lib/metrics";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function fixtureRelease(): GasRelease {
  return gasReleaseSchema.parse(JSON.parse(read("tests/fixtures/gas/release.json")));
}

describe("phase 1A release gate", () => {
  const catalogue = loadAssetCatalogue();

  it("reads an empty gas bundle as not yet available", () => {
    const now = new Date("2026-10-15T09:10:00.000Z");
    const readings = gasReadingsFromReleases([], now);
    expect(readings.map((row) => row.metric_id)).toEqual(Object.keys(GAS_METRICS));
    for (const row of readings) {
      expect(row.value).toBeNull();
      expect(row.published_at).toBeNull();
      expect(row.state).toBe("not_yet_available");
    }
  });

  it("keeps a genuine zero and leaves a missing series unpublished", () => {
    const now = new Date("2026-10-15T09:10:00.000Z");
    const release = fixtureRelease();
    const nationals = release.components.filter((row) => row.metric_id === "gas.gb_nts.entry.physical.national");
    const latest = nationals.reduce((best, row) => (row.applicable_at > best.applicable_at ? row : best));
    const zeroed: GasRelease = {
      ...release,
      components: release.components.map((row) =>
        row.metric_id === latest.metric_id && row.applicable_at === latest.applicable_at
          ? { ...row, value: 0, published_at: now.toISOString() }
          : row,
      ),
    };
    const readings = gasReadingsFromReleases([zeroed], now);
    const national = readings.find((row) => row.metric_id === "gas.gb_nts.entry.physical.national");
    expect(national?.value).toBe(0);
    expect(national?.state).toBeNull();
    expect(national?.published_at).toBe(now.toISOString());
    const present = new Set(zeroed.components.map((row) => row.metric_id));
    const missing = (Object.keys(GAS_METRICS) as GasMetricId[]).find((id) => !present.has(id));
    expect(missing).toBeDefined();
    const absent = readings.find((row) => row.metric_id === missing);
    expect(absent?.value).toBeNull();
    expect(absent?.published_at).toBeNull();
    expect(absent?.state).toBe("not_yet_available");
  });

  it("records an operator and never an owner", () => {
    const station = [...catalogue.details.values()].find((detail) => detail.link === null);
    const link = [...catalogue.details.values()].find((detail) => detail.link?.fuelinstCode);
    expect(station).toBeDefined();
    expect(link).toBeDefined();
    if (!station || !link) {
      return;
    }
    const stationModel = assetPageModel(station);
    const owner = stationModel.claims.find((claim) => claim.role === "Owner");
    expect(owner?.value).toBe(NOT_AVAILABLE);
    expect(owner?.evidence).toBe("The register records an operator, not an owner.");
    const linkOwner = assetPageModel(link).claims.find((claim) => claim.role === "Owner");
    expect(linkOwner?.value).toBe(NOT_AVAILABLE);
    expect(linkOwner?.evidence).toContain("does not name an owner");
  });

  it("keeps approximate coordinates and refuses the origin", () => {
    expect(catalogue.rows.some((row) => row.latitude === null || row.longitude === null)).toBe(true);
    expect(catalogue.rows.some((row) => row.latitude === 0 && row.longitude === 0)).toBe(false);
    expect(catalogue.dno.precision).toBe("published_approximate");
    const located = [...catalogue.details.values()].find(
      (detail) => detail.link === null && detail.row.latitude !== null && detail.row.longitude !== null,
    );
    expect(located).toBeDefined();
    if (!located) {
      return;
    }
    const precision = assetPageModel(located).facts.find((fact) => fact.id === "precision");
    expect(precision?.value).toBe("Published, approximate");
  });

  it("copies a map filter into the query string the directory reads", () => {
    const serialize = createSerializer(mapViewParsers);
    const query = serialize({ q: "drax", technology: "biomass", layers: "ic" });
    const params = new URLSearchParams(query);
    expect(params.get("q")).toBe("drax");
    expect(params.get("technology")).toBe("biomass");
    expect(params.get("layers")).toBe("ic");
    const matched = matchingAssets(catalogue.rows, {
      q: params.get("q") ?? "",
      technology: "biomass",
      status: null,
      source: null,
      region: "",
      sort: "name",
      dir: "asc",
      page: 1,
      pageSize: 50,
    });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((row) => row.technology === "biomass")).toBe(true);
    expect(matched.length).toBeLessThan(catalogue.rows.length);
  });

  it("keeps the asset list when the basemap fails", () => {
    const map = read("src/components/power-map.tsx");
    const page = read("src/app/map/page.tsx");
    expect(map).toContain("Basemap tiles did not load. The asset list is still available.");
    expect(page).toContain('id="asset-list"');
  });

  it("stamps export metadata and route credits from the attribution module", () => {
    const release = fixtureRelease();
    expect(release.attribution).toBe(NATIONAL_GAS_ATTRIBUTION);
    const sources = cataloguePageSources();
    expect(sources.find((source) => source.id === "national-gas")?.attribution).toBe(NATIONAL_GAS_ATTRIBUTION);
    expect(sources.find((source) => source.id === "neso-dno-areas")?.attribution).toBe(DNO_ATTRIBUTION);
    expect(sources.find((source) => source.id === "os-open-zoomstack")?.attribution).toBe(osBasemapAttribution(2026));
    expect(catalogue.basemap.attribution).toBe(osBasemapAttribution(2026));
    expect(catalogue.dno.attribution).toBe(DNO_ATTRIBUTION);
    expect(catalogue.dno.accuracyWarning).toBe(NESO_DNO_ACCURACY_WARNING);
    expect(catalogue.elexonAttribution.length).toBeGreaterThan(0);
    expect(catalogue.nationalGasAttribution).toBe(NATIONAL_GAS_ATTRIBUTION);
    expect(read("src/app/gas/page.tsx")).toContain("GAS_ATTRIBUTION");
    expect(read("src/app/map/page.tsx")).toContain("nationalGasAttribution={catalogue.nationalGasAttribution}");
    expect(read("src/app/assets/[id]/[slug]/page.tsx")).toContain("withRegisterCredits");
    expect(read("src/lib/gas/copy.ts")).toContain("NATIONAL_GAS_ATTRIBUTION");
    expect(OGL_V3_ATTRIBUTION).toContain("Open Government Licence v3.0");
  });
});
