import { describe, expect, it } from "vitest";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { buildTodayFigures, isGbOperatingPlant, pipelineClass, sumDisplayedGw, type TodayPlant, type TodayProject } from "@/lib/map/today-figures";
import { loadProjectCatalogue } from "@/lib/projects/load";

function tenths(values: readonly (string | null)[]): number {
  return values.reduce((sum, value) => sum + (value === null ? 0 : Math.round(Number(value) * 10)), 0);
}

function plant(patch: Partial<TodayPlant> & Pick<TodayPlant, "technology" | "country" | "mw">): TodayPlant {
  return patch;
}

function project(patch: Partial<TodayProject> & Pick<TodayProject, "technology" | "displayStage">): TodayProject {
  return {
    country: "England",
    operationalStatus: "proposed",
    powerMw: 10,
    sources: ["desnz-repd"],
    ...patch,
  };
}

describe("today figures", () => {
  it("drops Northern Ireland and non-generation rows from the built fleet", () => {
    const plants = [
      plant({ technology: "ccgt", country: "England", mw: 1000 }),
      plant({ technology: "solar_pv", country: "Northern Ireland", mw: 400 }),
      plant({ technology: "solar_pv", country: null, mw: 50 }),
      plant({ technology: "interconnector", country: "England", mw: 2000 }),
      plant({ technology: "gas_terminal", country: "Wales", mw: 80 }),
      plant({ technology: "onshore_wind", country: "Scotland", mw: 100 }),
    ];
    expect(plants.filter(isGbOperatingPlant)).toHaveLength(2);
    const figures = buildTodayFigures(plants, []);
    expect(figures.operating.sites).toBe(2);
    expect(figures.technologies.map((row) => row.id)).toEqual(["gas", "onshore_wind"]);
    expect(figures.nations.find((row) => row.id === "Wales")).toBeUndefined();
  });

  it("reconciles technology rows, nations, and pipeline stages to their totals", () => {
    const plants = [
      plant({ technology: "ccgt", country: "England", mw: 1500 }),
      plant({ technology: "ocgt", country: "Wales", mw: 40 }),
      plant({ technology: "offshore_wind", country: "Scotland", mw: 600 }),
      plant({ technology: "solar_pv", country: "England", mw: null }),
    ];
    const projects = [
      project({
        technology: "battery",
        displayStage: "operational",
        operationalStatus: "operational",
        country: "England",
        powerMw: 250,
      }),
      project({
        technology: "battery",
        displayStage: "operational",
        operationalStatus: "operational",
        country: "Northern Ireland",
        powerMw: 999,
      }),
      project({ technology: "solar_pv", displayStage: "under_construction", powerMw: 100.04, country: "England" }),
      project({ technology: "offshore_wind", displayStage: "consented", powerMw: 200, country: "Scotland" }),
      project({ technology: "onshore_wind", displayStage: "in_planning", powerMw: 50, country: "Wales" }),
      project({
        technology: "ccgt",
        displayStage: "under_construction",
        country: null,
        powerMw: null,
        sources: ["neso-open-data"],
      }),
      project({
        technology: "ccgt",
        displayStage: "consented",
        country: null,
        powerMw: 800,
        sources: ["desnz-repd"],
      }),
    ];
    const figures = buildTodayFigures(plants, projects);
    expect(figures.technologies.some((row) => row.id === "battery")).toBe(true);
    expect(tenths(figures.technologies.map((row) => row.gw))).toBe(tenths([figures.operating.gw]));
    expect(figures.technologies.reduce((sum, row) => sum + row.sites, 0)).toBe(figures.operating.sites);
    expect(tenths(figures.nations.map((row) => row.gw))).toBe(tenths([figures.operating.gw]));
    expect(tenths(figures.pipeline.stages.map((row) => row.gw))).toBe(tenths([figures.pipeline.gw]));
    expect(figures.pipeline.stages.reduce((sum, row) => sum + row.sites, 0)).toBe(figures.pipeline.sites);
    expect(figures.pipeline.filtered).toBe(true);
    expect(figures.pipeline.stages.find((row) => row.id === "under_construction")?.sites).toBe(2);
    expect(figures.nations.find((row) => row.id === "Wales")?.gw).toBeNull();
    expect(JSON.stringify(figures)).not.toMatch(/"gw":"0(?:\.0)?"/);
    expect(sumDisplayedGw(figures.technologies.map((row) => row.gw))).toBeCloseTo(Number(figures.operating.gw), 5);
  });

  it("says the pipeline is unfiltered when no row has a country", () => {
    const figures = buildTodayFigures(
      [plant({ technology: "ccgt", country: "England", mw: 10 })],
      [
        project({
          technology: "solar_pv",
          displayStage: "in_planning",
          country: null,
          powerMw: 20,
          sources: ["desnz-repd"],
        }),
      ],
    );
    expect(figures.pipeline.filtered).toBe(false);
    expect(pipelineClass(project({ technology: "solar_pv", displayStage: "in_planning", country: null, sources: ["desnz-repd"] }))).toBe(
      "out",
    );
  });

  it("matches the checked-in Great Britain register", () => {
    const plants = loadAssetCatalogue().rows.map((row) => ({
      technology: row.technology,
      country: row.country,
      mw: row.mw,
    }));
    const projects = loadProjectCatalogue().projects.map((project) => ({
      technology: project.technology,
      country: project.country,
      displayStage: project.display_stage,
      operationalStatus: project.operational_status,
      powerMw: project.power_mw,
      sources: project.members.map((member) => member.source_id),
    }));
    const northernIreland = plants.filter((row) => row.country === "Northern Ireland" && isGbOperatingPlant(row));
    const links = plants.filter((row) => row.technology === "interconnector" || row.technology === "gas_terminal");
    expect(plants.some((row) => row.country === "Northern Ireland")).toBe(true);
    expect(northernIreland).toEqual([]);
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter(isGbOperatingPlant)).toEqual([]);

    const figures = buildTodayFigures(plants, projects);
    expect(figures.availability).toBe("ready");
    expect(figures.operating.gw).not.toBeNull();
    expect(figures.operating.sites).toBeGreaterThan(3189);
    expect(figures.technologies.map((row) => row.id)).toContain("battery");
    expect(tenths(figures.technologies.map((row) => row.gw))).toBe(tenths([figures.operating.gw]));
    expect(figures.technologies.reduce((sum, row) => sum + row.sites, 0)).toBe(figures.operating.sites);
    expect(tenths(figures.nations.map((row) => row.gw))).toBe(tenths([figures.operating.gw]));
    expect(figures.nations.map((row) => row.id)).toEqual(["England", "Scotland", "Wales"]);
    expect(tenths(figures.pipeline.stages.map((row) => row.gw))).toBe(tenths([figures.pipeline.gw]));
    expect(figures.pipeline.stages.reduce((sum, row) => sum + row.sites, 0)).toBe(figures.pipeline.sites);
    expect(figures.pipeline.filtered).toBe(true);
    expect(figures.largestLabels.slice(0, 3)).toEqual(["Gas", "Offshore wind", "Onshore wind"]);
    for (const row of [...figures.technologies, ...figures.nations, ...figures.pipeline.stages]) {
      expect(row.gw).not.toBe("0");
      expect(row.gw).not.toBe("0.0");
    }
  });
});
