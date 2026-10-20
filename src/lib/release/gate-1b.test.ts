import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EIRGRID_GROUP_ATTRIBUTION,
  EIRGRID_GROUP_LICENCE_READ_ON,
  ELEXON_ISD_ATTRIBUTION,
  GEONAMES_ATTRIBUTION,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_READ_ON,
  NESO_OPEN_DATA_LICENCE_URL,
  OGL_V3_ATTRIBUTION,
} from "@/lib/attribution";
import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import { ABSENT_FIGURE, assessPublication } from "@/lib/data-state";
import { INDEXNOW_PHASE_1A_PATHS } from "@/lib/indexnow";
import { DNO_LICENCE_URL } from "@/lib/map/constants";
import { CONSTRAINT_METRICS, EIRGRID_METRICS, staleGrace } from "@/lib/metrics";
import { SITEMAP_PATHS } from "@/lib/sitemap-routes";
import { visibleHeaderNav } from "@/lib/site-nav";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("phase 1B release gate", () => {
  it("keeps the homepage static and off the 1B readers", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("export const revalidate = 300");
    expect(page).toContain('export const dynamic = "force-static"');
    for (const banned of [
      "maplibre",
      "pmtiles",
      "queryPipe",
      "@/lib/constraints",
      "@/lib/directory",
      "@/lib/projects",
      "@/lib/whole-energy",
      "@/lib/eirgrid/release",
      "@/lib/eirgrid/parse",
      "@/lib/ingest/national-gas",
      "data.nationalgas.com",
    ]) {
      expect(page).not.toContain(banned);
    }
  });

  it("shows only shipped system items", () => {
    const system = visibleHeaderNav().find((entry) => entry.id === "system");
    expect(system?.kind).toBe("menu");
    if (system?.kind !== "menu") {
      return;
    }
    expect(system.items.map((item) => item.href)).toEqual([
      "/system/constraints",
      "/system/storage",
      "/system/whole-energy",
      "/projects",
      "/pipeline",
      "/electricity/northern-ireland",
    ]);
    for (const hidden of ["/system/generation", "/system/demand", "/system/carbon", "/system/transfers"]) {
      expect(system.items.some((item) => item.href === hidden)).toBe(false);
    }
  });

  it("includes the shipped /map flows route", () => {
    expect(SITEMAP_PATHS.some((entry) => entry.path === "/map")).toBe(true);
    expect(INDEXNOW_PHASE_1A_PATHS).toContain("/map");
    const page = read("src/app/map/page.tsx");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 1_800");
    expect(page).not.toContain("queryPipe");
    const image = read("src/app/map/opengraph-image.tsx");
    expect(image).toContain("facts: null");
    expect(image).toContain("records: null");
    expect(image).toContain("prices: null");
    expect(image).not.toContain("queryPipe");
    expect(image).not.toContain("peekWarmed");
  });

  it("includes the shipped /pipeline route", () => {
    expect(SITEMAP_PATHS.some((entry) => entry.path === "/pipeline")).toBe(true);
    expect(INDEXNOW_PHASE_1A_PATHS).not.toContain("/pipeline");
    const page = read("src/app/pipeline/page.tsx");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 86400");
    expect(page).not.toContain("queryPipe");
    const image = read("src/app/pipeline/opengraph-image.tsx");
    expect(image).toContain("facts: null");
    expect(image).toContain("records: null");
    expect(image).toContain("prices: null");
    expect(image).not.toContain("queryPipe");
    expect(image).not.toContain("peekWarmed");
  });

  it("records the 20 Oct 2026 licence read and credits GeoNames", () => {
    const sources = cataloguePageSources();
    const neso = sources.find((source) => source.id === "neso-open-data");
    expect(neso?.attribution).toBe(NESO_OPEN_DATA_ATTRIBUTION);
    expect(neso?.licenceUrl).toBe(NESO_OPEN_DATA_LICENCE_URL);
    expect(neso?.licence).toContain("20 Oct 2026");
    expect(NESO_OPEN_DATA_LICENCE_READ_ON).toBe("2026-10-20");
    expect(neso?.usedFor).toContain("constraint");
    expect(neso?.usedFor).toContain("transmission entry capacity");
    expect(neso?.usedFor).toContain("interconnector register");
    const dukes = sources.find((source) => source.id === "desnz-dukes");
    const repd = sources.find((source) => source.id === "desnz-repd");
    expect(dukes?.attribution).toBe(OGL_V3_ATTRIBUTION);
    expect(repd?.attribution).toBe(OGL_V3_ATTRIBUTION);
    expect(dukes?.usedFor).toContain("energy flow chart");
    const eirgrid = sources.find((source) => source.id === "eirgrid-group");
    expect(eirgrid?.attribution).toBe(EIRGRID_GROUP_ATTRIBUTION);
    expect(eirgrid?.licence).toContain("20 Oct 2026");
    expect(EIRGRID_GROUP_LICENCE_READ_ON).toBe("2026-10-20");
    const isd = sources.find((source) => source.id === "elexon-isd");
    expect(isd?.attribution).toBe(ELEXON_ISD_ATTRIBUTION);
    expect(isd?.licence).toContain("does not make that identification");
    expect(sources.some((source) => source.id === "elexon-bmrs") && sources.some((source) => source.licence.includes("20 Oct 2026"))).toBe(true);
    const places = sources.find((source) => source.id === "geonames");
    expect(places?.attribution).toBe(GEONAMES_ATTRIBUTION);
    expect(places?.attribution).toContain("CC BY 4.0");
    expect(places?.usedFor).toContain("Schematic landing points");
    expect(JSON.stringify(sources)).not.toMatch(/OilPriceAPI|TTF/);
    const layers = JSON.parse(read("data/catalogue/layers.json")) as Array<{ id: string; licence_url: string }>;
    expect(layers.find((layer) => layer.id === "dno")?.licence_url).toBe(DNO_LICENCE_URL);
  });

  it("marks a constraint cost stale after the grace and leaves a fresh EirGrid sample current", () => {
    const cost = CONSTRAINT_METRICS["elec.gb.constraints.cost.thermal"];
    const freshCost = assessPublication({
      value: 12,
      publishedAt: "2026-10-01T00:00:00.000Z",
      retrievedAt: "2026-10-01T04:00:00.000Z",
      expectedCadence: cost.expected_cadence,
      now: new Date("2026-10-15T12:00:00.000Z"),
      publicationLag: staleGrace(cost),
    });
    const staleCost = assessPublication({
      value: 12,
      publishedAt: "2026-10-01T00:00:00.000Z",
      retrievedAt: "2026-10-01T04:00:00.000Z",
      expectedCadence: cost.expected_cadence,
      now: new Date("2026-10-17T00:00:00.000Z"),
      publicationLag: staleGrace(cost),
    });
    expect(freshCost.stale).toBe(false);
    expect(freshCost.state).toBeNull();
    expect(staleCost.stale).toBe(true);
    expect(staleCost.state).toBe("stale");

    const demand = EIRGRID_METRICS["elec.ni.demand.system"];
    const freshDemand = assessPublication({
      value: 400,
      publishedAt: "2026-10-20T11:00:00.000Z",
      retrievedAt: "2026-10-20T11:05:00.000Z",
      expectedCadence: demand.expected_cadence,
      now: new Date("2026-10-20T12:00:00.000Z"),
      publicationLag: staleGrace(demand),
    });
    const staleDemand = assessPublication({
      value: 400,
      publishedAt: "2026-10-20T11:00:00.000Z",
      retrievedAt: "2026-10-20T11:05:00.000Z",
      expectedCadence: demand.expected_cadence,
      now: new Date("2026-10-20T12:16:00.000Z"),
      publicationLag: staleGrace(demand),
    });
    expect(freshDemand.stale).toBe(false);
    expect(staleDemand.state).toBe("stale");
  });

  it("reads a missing constraint value as not yet available and keeps a genuine zero", () => {
    const cost = CONSTRAINT_METRICS["elec.gb.constraints.cost.thermal"];
    const missing = assessPublication({
      value: null,
      publishedAt: null,
      retrievedAt: null,
      expectedCadence: cost.expected_cadence,
      now: new Date("2026-10-20T12:00:00.000Z"),
      publicationLag: staleGrace(cost),
    });
    const zero = assessPublication({
      value: 0,
      publishedAt: "2026-10-18T00:00:00.000Z",
      retrievedAt: "2026-10-18T04:00:00.000Z",
      expectedCadence: cost.expected_cadence,
      now: new Date("2026-10-20T12:00:00.000Z"),
      publicationLag: staleGrace(cost),
    });
    expect(missing.state).toBe("not_yet_available");
    expect(missing.valueLabel).toBe(ABSENT_FIGURE);
    expect(missing.stale).toBe(false);
    expect(zero.state).toBeNull();
    expect(zero.stale).toBe(false);
    expect(zero.valueLabel).toBe("0");
  });

  it("keeps the blocked list written and unmarked", () => {
    const notes = read("docs/release-1b.md");
    const start = notes.indexOf("## Source-blocked, not done");
    expect(start).toBeGreaterThanOrEqual(0);
    const blocked = notes.slice(start);
    for (const phrase of [
      "ISD extract export",
      "redistribution not permitted",
      "ENA and DNO connection registers",
      "Northern Ireland coal",
      "Northern Ireland other fossil",
      "Northern Ireland-only SNSP",
      "Sterling imbalance price",
    ]) {
      expect(blocked).toContain(phrase);
    }
    expect(blocked).not.toMatch(/marked done/i);
  });

  it("passes an empty snapshot to the 1B open-graph file routes", () => {
    const routes = [
      "src/app/system/constraints/opengraph-image.tsx",
      "src/app/system/storage/opengraph-image.tsx",
      "src/app/system/whole-energy/opengraph-image.tsx",
      "src/app/projects/opengraph-image.tsx",
      "src/app/projects/[id]/[slug]/opengraph-image.tsx",
      "src/app/electricity/northern-ireland/opengraph-image.tsx",
      "src/app/tools/opengraph-image.tsx",
      "src/app/changes/opengraph-image.tsx",
      "src/app/directory/opengraph-image.tsx",
      "src/app/directory/identifiers/opengraph-image.tsx",
      "src/app/pipeline/opengraph-image.tsx",
    ];
    for (const route of routes) {
      const source = read(route);
      expect(source).toContain("facts: null");
      expect(source).toContain("records: null");
      expect(source).toContain("prices: null");
      expect(source).not.toContain("queryPipe");
      expect(source).not.toContain("peekWarmed");
    }
  });
});
