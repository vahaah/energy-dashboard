import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assetPath } from "@/lib/assets/href";
import { DURATION_TOOLTIP } from "@/lib/assets/labels";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { assetPageModel } from "@/lib/assets/page-model";
import { matchingAssets } from "@/lib/assets/query";
import { resolveAssetRoute } from "@/lib/assets/route";
import {
  flowDirection,
  flowsForCode,
  isResidualImportsCode,
  sameFuelinstCode,
} from "@/lib/assets/flows";
import { roundMw } from "@/lib/catalogue/assets/parse";
import { drawableLine, interconnectorFeatureCollection } from "@/lib/map/interconnector-layer";
import { isOrigin } from "@/lib/map/origin";
import { mapCountLine, mapCounts } from "@/lib/map/counts";
import type { AssetDetail } from "@/lib/assets/types";
import type { InterconnectorFlow } from "@/lib/types";
import summary from "../../../data/catalogue/asset_summary.json";

const CODES = ["INTFR", "INTIFA2", "INTELEC", "INTNED", "INTNEM", "INTNSL", "INTVKL", "INTIRL", "INTEW", "INTGRNL"] as const;

function flow(interconnector: string, generationMw: number): InterconnectorFlow {
  return {
    timestamp: "2026-10-15T00:00:00Z",
    interconnector,
    generation_mw: generationMw,
    direction: generationMw >= 0 ? "import" : "export",
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe("asset page acceptance", () => {
  const catalogue = loadAssetCatalogue();

  it("slug 308s and an unknown id 404s", () => {
    const row = catalogue.rows.find((item) => item.id === "ast_5c5dc7c6656c3f93");
    expect(row?.name).toBe("IFA");
    if (!row) {
      return;
    }
    const canonical = assetPath(row.id, row.name);
    expect(canonical).toBe("/assets/ast_5c5dc7c6656c3f93/ifa");
    expect(resolveAssetRoute(row.id, undefined, catalogue.rows)).toEqual({ status: 308, location: canonical });
    expect(resolveAssetRoute(row.id, "wrong-slug", catalogue.rows)).toEqual({ status: 308, location: canonical });
    expect(resolveAssetRoute(row.id, "ifa", catalogue.rows)).toEqual({ status: 200, location: canonical });
    expect(resolveAssetRoute("ast_0000000000000000", "missing", catalogue.rows)).toEqual({ status: 404 });
    expect(resolveAssetRoute("ast_0000000000000000", undefined, catalogue.rows)).toEqual({ status: 404 });
  });

  it("keeps two assets with the same name separate", () => {
    const shared = [
      { id: "ast_aaaaaaaaaaaaaaaa", name: "Shared Name" },
      { id: "ast_bbbbbbbbbbbbbbbb", name: "Shared Name" },
    ];
    const left = assetPath(shared[0].id, shared[0].name);
    const right = assetPath(shared[1].id, shared[1].name);
    expect(left).not.toBe(right);
    expect(resolveAssetRoute(shared[0].id, "shared-name", shared).status).toBe(200);
    expect(resolveAssetRoute(shared[1].id, "shared-name", shared).status).toBe(200);
    const groups = new Map<string, string[]>();
    for (const row of catalogue.rows) {
      const paths = groups.get(row.name) ?? [];
      paths.push(assetPath(row.id, row.name));
      groups.set(row.name, paths);
    }
    for (const paths of groups.values()) {
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it("attaches flow only to mapped INT codes and never draws intneso", () => {
    const rows = [
      flow("intfr", 400),
      flow("INTFR", 400),
      flow("Intfr", 12),
      flow("IFA", 900),
      flow("France (IFA)", 900),
      flow("intneso", 50),
      flow("INTNESO", 50),
      flow("intifa2", -20),
    ];
    expect(flowsForCode("INTFR", rows).map((row) => row.interconnector)).toEqual(["intfr", "INTFR"]);
    expect(flowsForCode("INTIFA2", rows).map((row) => row.interconnector)).toEqual(["intifa2"]);
    expect(flowsForCode("INTNESO", rows)).toEqual([]);
    expect(flowsForCode("intneso", rows)).toEqual([]);
    expect(flowsForCode("IFA", rows)).toEqual([]);
    expect(sameFuelinstCode("INTFR", "Intfr")).toBe(false);
    expect(isResidualImportsCode("intneso")).toBe(true);
    expect(flowDirection(400)).toBe("import");
    expect(flowDirection(-1)).toBe("export");
    expect(catalogue.lines.map((line) => line.code).sort()).toEqual([...CODES].sort());
    expect(catalogue.lines.some((line) => line.code.toUpperCase() === "INTNESO")).toBe(false);
    const residual = {
      id: "ast_0000000000000001",
      name: "Imports",
      code: "INTNESO",
      gbLongitude: -1,
      gbLatitude: 54,
      remoteLongitude: 2,
      remoteLatitude: 50,
    };
    const origin = { ...residual, id: "ast_0000000000000002", code: "INTFR", gbLongitude: 0, gbLatitude: 0 };
    expect(drawableLine(residual)).toBe(false);
    expect(drawableLine(origin)).toBe(false);
    expect(interconnectorFeatureCollection([residual, origin, catalogue.lines[0]!]).features).toHaveLength(1);
    const flowsSource = readFileSync(resolve(process.cwd(), "src/lib/assets/cached-flows.ts"), "utf8");
    expect(flowsSource).toContain("peekWarmedPipe");
    expect(flowsSource).not.toContain("queryPipe");
  });

  it("draws no asset at (0, 0)", () => {
    for (const point of catalogue.points) {
      expect(isOrigin(point.longitude, point.latitude)).toBe(false);
    }
    for (const line of catalogue.lines) {
      expect(isOrigin(line.gbLongitude, line.gbLatitude)).toBe(false);
      expect(isOrigin(line.remoteLongitude, line.remoteLatitude)).toBe(false);
    }
    for (const row of catalogue.rows) {
      if (row.latitude !== null && row.longitude !== null) {
        expect(isOrigin(row.longitude, row.latitude)).toBe(false);
      }
    }
  });

  it("matches map counts to the filtered list", () => {
    const lineById = new Map(catalogue.lines.map((line) => [line.id, line]));
    const census = catalogue.rows.map((row) => {
      const line = lineById.get(row.id);
      return {
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        line: line
          ? {
              gbLongitude: line.gbLongitude,
              gbLatitude: line.gbLatitude,
              remoteLongitude: line.remoteLongitude,
              remoteLatitude: line.remoteLatitude,
            }
          : null,
      };
    });
    const counts = mapCounts(census, null);
    const matched = matchingAssets(catalogue.rows, {
      q: "",
      technology: null,
      status: null,
      source: null,
      region: "",
      sort: "name",
      dir: "asc",
      page: 1,
      pageSize: 1,
    });
    expect(counts.matching).toBe(matched.length);
    expect(counts.matching).toBe(catalogue.rows.length);
    expect(counts.inView + counts.unlocated).toBe(counts.matching);
    expect(counts.unlocated).toBe(10);
    expect(counts.inView).toBe(catalogue.points.length + catalogue.lines.length);
    expect(counts.line).toBe(mapCountLine(counts));
    expect(counts.line).toBe("3329 in view · 3339 matching filters · 10 without a location");
    expect(counts.line).not.toMatch(/\d,\d/);
    const filtered = matchingAssets(catalogue.rows, {
      q: "",
      technology: "interconnector",
      status: null,
      source: null,
      region: "",
      sort: "name",
      dir: "asc",
      page: 1,
      pageSize: 1,
    });
    const filteredCounts = mapCounts(
      census.filter((asset) => filtered.some((row) => row.id === asset.id)),
      null,
    );
    expect(filteredCounts.matching).toBe(filtered.length);
    expect(filteredCounts.line).toBe("10 in view · 10 matching filters · 0 without a location");
  });

  it("reconciles every displayed megawatt with the register summary", () => {
    let raw = 0;
    for (const detail of catalogue.details.values()) {
      if (detail.link) {
        expect(detail.row.mw).toBeNull();
        continue;
      }
      const current = detail.capacity.filter((record) => record.current && record.counts);
      const counted = current.reduce((sum, record) => sum + record.mw, 0);
      raw += counted;
      expect(detail.row.mw).toBe(current.length > 0 ? roundMw(counted) : null);
    }
    expect(round3(raw)).toBe(summary.counted_mw);
    expect(summary.counted_mw).toBe(98410.191);
    expect(summary.assets).toBe(3321);
  });

  it("keeps storage energy out of the megawatt column", () => {
    const detail: AssetDetail = {
      row: {
        id: "ast_1111111111111111",
        name: "Dinorwig",
        operator: "",
        technology: "pumped_storage",
        status: "operational",
        mw: null,
        region: "North Wales",
        location: "North Wales",
        country: "Wales",
        source: "DUKES",
        sources: ["DUKES"],
        latitude: null,
        longitude: null,
        aka: "",
      },
      projects: [],
      capacity: [],
      matches: [],
      link: null,
    };
    const model = assetPageModel(detail);
    const mw = model.facts.find((fact) => fact.id === "mw");
    const mwh = model.facts.find((fact) => fact.id === "mwh");
    expect(mw?.column).toBe(1);
    expect(mwh?.column).toBe(2);
    expect(mw?.value).toBe("Not available");
    expect(mwh?.value).toBe("Not available");
    expect(model.facts.find((fact) => fact.id === "duration")?.tooltip).toBe(DURATION_TOOLTIP);
    expect(model.miniMap.kind).toBe("none");
  });
});
