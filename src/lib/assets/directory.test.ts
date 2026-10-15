import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeAssetIndex, encodeAssetIndex } from "@/lib/assets/index-file";
import { containsLiveWord, MAP_COVERAGE_COPY } from "@/lib/assets/labels";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { searchAssets } from "@/lib/assets/query";
import { osBasemapAttribution, NESO_DNO_ACCURACY_WARNING } from "@/lib/map/constants";

describe("checked-in asset catalogue", () => {
  const catalogue = loadAssetCatalogue();

  it("places stations in DNO areas and keeps operators searchable", () => {
    expect(catalogue.rows).toHaveLength(3339);
    expect(catalogue.points.length).toBe(3319);
    expect(catalogue.lines).toHaveLength(10);
    const plants = catalogue.rows.filter((row) => row.technology !== "interconnector" && row.technology !== "gas_terminal");
    expect(plants).toHaveLength(3321);
    const missingCoordinates = plants.filter((row) => row.latitude === null || row.longitude === null);
    expect(missingCoordinates).toHaveLength(2);
    const gas = catalogue.rows.filter((row) => row.technology === "gas_terminal");
    expect(gas).toHaveLength(8);
    expect(gas.every((row) => row.latitude === null && row.longitude === null && row.location === "Location unavailable")).toBe(true);
    const unlocated = catalogue.rows.filter((row) => row.region === "Not located");
    expect(unlocated.map((row) => row.id)).toEqual(["ast_ee6e8059dff48c01"]);
    expect(missingCoordinates.find((row) => row.country === "England")?.region).not.toBe("Not located");
    expect(catalogue.rows.some((row) => row.region === "London")).toBe(true);
    expect(catalogue.rows.some((row) => row.operator.length > 0)).toBe(true);
    expect(catalogue.dno.defaultVisible).toBe(false);
    expect(catalogue.dno.accuracyWarning).toBe(NESO_DNO_ACCURACY_WARNING);
    expect(catalogue.basemap.attribution).toBe(osBasemapAttribution(2026));
    expect(catalogue.basemap.attribution).toBe("Contains OS data © Crown copyright and database right 2026");
    const nuclear = catalogue.rows.filter((row) => row.technology === "nuclear");
    expect(nuclear).toHaveLength(5);
    expect(nuclear.every((row) => row.source === "DUKES")).toBe(true);
    expect(searchAssets(catalogue.rows, "Sizewell", 5).length).toBeGreaterThan(0);
    expect(searchAssets(catalogue.rows, "Lightsource", 5).length).toBeGreaterThan(0);
    expect(containsLiveWord(MAP_COVERAGE_COPY)).toBe(false);
  });

  it("matches the build-generated search index", () => {
    const file = JSON.parse(readFileSync(resolve(process.cwd(), "public/search/assets.json"), "utf8")) as unknown;
    expect(decodeAssetIndex(file)).toEqual(catalogue.rows);
    expect(encodeAssetIndex(catalogue.rows)).toBe(readFileSync(resolve(process.cwd(), "public/search/assets.json"), "utf8"));
  });
});
