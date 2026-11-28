import { describe, expect, it } from "vitest";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { DISPLAY_STAGES, displayStageLabel } from "@/lib/projects/status";
import {
  projectDetailDescription,
  projectDetailTitle,
  projectSeoDescription,
  projectSeoTitle,
  projectTitleName,
  type ProjectSeoInput,
} from "@/lib/seo/project-meta";
import { DESCRIPTION_MAX_CHARS, pageDescriptionLength, pageTitleLength, TITLE_MAX_CHARS } from "@/lib/site";

function project(patch: Partial<ProjectSeoInput> & Pick<ProjectSeoInput, "name" | "technology">): ProjectSeoInput {
  return {
    powerMw: null,
    displayStage: "consented",
    ...patch,
  };
}

describe("project search titles", () => {
  it("does not repeat a technology the name already contains", () => {
    const title = projectDetailTitle(
      project({
        name: "Oving Solar Farm",
        technology: "solar_pv",
        powerMw: 5,
        displayStage: "operational",
        region: "South East",
      }),
    );
    expect(title).toBe("Oving Solar Farm 5 MW, South East: operational | Grid");
    expect(title).not.toBe("Oving Solar Farm solar");
    expect(title.match(/solar/gi)).toHaveLength(1);
  });

  it("drops the place when none is published", () => {
    const title = projectDetailTitle(
      project({
        name: "Folly Farm",
        technology: "battery",
        powerMw: 20,
        displayStage: "in_planning",
      }),
    );
    expect(title).toBe("Folly Farm 20 MW battery storage: in planning | Grid");
    expect(title).not.toContain(",");
  });

  it("drops capacity when it is not published", () => {
    const title = projectDetailTitle(
      project({
        name: "Folly Farm",
        technology: "battery",
        region: "South West",
      }),
    );
    expect(title).toBe("Folly Farm battery storage, South West: consented | Grid");
    expect(title).not.toMatch(/\d/);
    expect(title).not.toContain("MW");
  });

  it("trims capacity before place detail and keeps the name whole", () => {
    const title = projectDetailTitle(
      project({
        name: "Home Farm",
        technology: "battery",
        powerMw: 49.9,
        localAuthority: "Newcastle-under-Lyme",
        county: "Staffordshire",
        region: "West Midlands",
      }),
    );
    expect(title).toBe("Home Farm battery storage, Staffordshire: consented | Grid");
    expect(title).not.toContain("49.9");
    expect(title).not.toContain("Newcastle-under-Lyme");
    expect(title).not.toContain("West Midlands");
    expect(pageTitleLength(title)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
  });

  it("keeps a long name intact, with no ellipsis, after capacity and place are dropped", () => {
    const name = "North Meadow Extension Site Beside The Old Quarry Lane";
    const title = projectDetailTitle(
      project({
        name,
        technology: "battery",
        powerMw: 49.9,
        localAuthority: "Newcastle-under-Lyme",
        county: "Staffordshire",
        region: "West Midlands",
      }),
    );
    expect(title).toBe(`${name} battery storage: consented | Grid`);
    expect(title.startsWith(name)).toBe(true);
    expect(title).not.toContain("…");
    expect(title).not.toContain("49.9");
    expect(title).not.toContain("Staffordshire");
    expect(pageTitleLength(title)).toBeGreaterThan(TITLE_MAX_CHARS);
  });

  it("names each status in lowercase", () => {
    for (const stage of DISPLAY_STAGES) {
      const title = projectDetailTitle(
        project({
          name: "Bay",
          technology: "battery",
          displayStage: stage,
        }),
      );
      expect(title).toBe(`Bay battery storage: ${displayStageLabel(stage).toLowerCase()} | Grid`);
    }
  });

  it("does not use an offshore region as a place and falls back to the country", () => {
    const title = projectDetailTitle(
      project({
        name: "Dogger Bank",
        technology: "offshore_wind",
        powerMw: 12,
        region: "Offshore",
        country: "Scotland",
      }),
    );
    expect(title).toBe("Dogger Bank 12 MW offshore wind, Scotland: consented | Grid");
    expect(title).not.toContain("Offshore");
  });
});

describe("project search descriptions", () => {
  it("names technology, capacity, the most specific place and the status", () => {
    const description = projectDetailDescription(
      project({
        name: "Home Farm",
        technology: "battery",
        powerMw: 49.9,
        localAuthority: "Newcastle-under-Lyme",
        county: "Staffordshire",
        region: "West Midlands",
      }),
    );
    expect(description).toBe(
      "Home Farm is a 49.9 MW battery storage project in Newcastle-under-Lyme, Staffordshire. Consented. Planning status, location and grid connection details.",
    );
    expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(description).not.toContain("…");
  });

  it("omits the place and the capacity when they are missing", () => {
    const description = projectDetailDescription(
      project({
        name: "Folly Farm",
        technology: "onshore_wind",
        displayStage: "proposed",
      }),
    );
    expect(description).toBe(
      "Folly Farm is an onshore wind project. Proposed. Planning status, location and grid connection details.",
    );
    expect(description).not.toMatch(/ project in /);
    expect(description).not.toContain("MW");
  });

  it("uses an before a vowel capacity and a before a consonant", () => {
    const eight = projectDetailDescription(
      project({ name: "Pond", technology: "solar_pv", powerMw: 8, region: "Scotland" }),
    );
    expect(eight.startsWith("Pond is an 8 MW solar project in Scotland.")).toBe(true);
    const fifty = projectDetailDescription(
      project({ name: "Pond", technology: "solar_pv", powerMw: 50, region: "Scotland" }),
    );
    expect(fifty.startsWith("Pond is a 50 MW solar project in Scotland.")).toBe(true);
  });

  it("says agricultural solar when the register name distinguishes it", () => {
    const description = projectDetailDescription(
      project({
        name: "Mushroom Farm, Lower Fields - Agricultural Building & Solar Panels",
        technology: "solar_pv",
        powerMw: 0.58,
        region: "East Midlands",
      }),
    );
    expect(description).toContain("agricultural solar");
    expect(description.startsWith("Mushroom Farm is a 0.6 MW agricultural solar project")).toBe(true);
    expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    const title = projectDetailTitle(
      project({
        name: "Mushroom Farm, Lower Fields - Agricultural Building & Solar Panels",
        technology: "solar_pv",
        powerMw: 0.58,
        region: "East Midlands",
      }),
    );
    expect(title).toBe("Mushroom Farm 0.6 MW agricultural solar: consented | Grid");
  });

  it("includes the applicant when it fits and leaves it out when it does not", () => {
    const description = projectDetailDescription(
      project({
        name: "Bay",
        technology: "battery",
        powerMw: 10,
        county: "Kent",
        developer: "Acme Energy",
      }),
    );
    expect(description).toContain("from Acme Energy");
    expect(description).toContain("in Kent");
    expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);

    const longDeveloper = "Very Long Applicant Name ".repeat(12).trim();
    const tight = projectDetailDescription(
      project({
        name: "Bay",
        technology: "battery",
        powerMw: 10,
        county: "Kent",
        developer: longDeveloper,
      }),
    );
    expect(tight).not.toContain(longDeveloper);
    expect(tight).toContain("in Kent");
    expect(pageDescriptionLength(tight)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(tight).not.toContain("…");
  });

  it("names each status without cutting a word", () => {
    for (const stage of DISPLAY_STAGES) {
      const description = projectDetailDescription(
        project({
          name: "Bay",
          technology: "battery",
          displayStage: stage,
          region: "Wales",
        }),
      );
      expect(description).toContain(`${displayStageLabel(stage)}.`);
      expect(description).toContain("in Wales");
      expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
      expect(description).not.toContain("…");
    }
  });

  it("shortens a very long name on a word boundary and stays within 155 characters", () => {
    const name = Array.from({ length: 40 }, (_, index) => `Word${index}`).join(" ");
    const description = projectDetailDescription(
      project({
        name,
        technology: "battery",
        powerMw: 49.9,
        county: "Staffordshire",
        developer: "Acme Energy",
      }),
    );
    expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(description).not.toContain("…");
    expect(description).not.toMatch(/\sWord\d+$/);
    const head = description.split(" is ")[0] ?? "";
    expect(name.startsWith(head)).toBe(true);
    expect(head.length).toBeGreaterThan(0);
    expect(name[head.length]).toBe(" ");
    expect(description.endsWith("Consented.")).toBe(true);
  });
});

describe("project catalogue titles", () => {
  const catalogue = loadProjectCatalogue();

  it("keeps every description within 155 characters and does not clip a name with an ellipsis", () => {
    for (const row of catalogue.projects) {
      const title = projectSeoTitle(row);
      const description = projectSeoDescription(row);
      const status = displayStageLabel(row.display_stage).toLowerCase();
      expect(title.endsWith(`: ${status} | Grid`)).toBe(true);
      expect(title).not.toContain("…");
      expect(title.startsWith(projectTitleName(row.name))).toBe(true);
      expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
      expect(description).not.toContain("…");
      expect(description).toContain(`${displayStageLabel(row.display_stage)}.`);
    }
  });

  it("matches the search shape for Armshead, Oving and Eurocell", () => {
    const armshead = catalogue.projects.find((row) => row.name.startsWith("Armshead Farm"));
    const oving = catalogue.projects.find((row) => row.name === "Oving Solar Farm");
    const eurocell = catalogue.projects.find((row) => row.name.includes("Eurocell Nickel"));
    expect(armshead).toBeDefined();
    expect(oving).toBeDefined();
    expect(eurocell).toBeDefined();
    if (!armshead || !oving || !eurocell) {
      return;
    }
    expect(projectSeoTitle(armshead)).toBe("Armshead Farm battery storage, West Midlands: consented | Grid");
    expect(projectSeoDescription(armshead)).toContain("50 MW battery storage project in the West Midlands");
    expect(projectSeoDescription(armshead)).toContain("Consented.");
    expect(projectSeoTitle(oving)).toBe("Oving Solar Farm 5 MW, South East: operational | Grid");
    expect(projectSeoTitle(eurocell)).toBe("Eurocell Nickel solar, East Midlands: in planning | Grid");
  });
});
