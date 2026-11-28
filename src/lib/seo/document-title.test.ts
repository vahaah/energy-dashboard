import { describe, expect, it } from "vitest";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { clipAtWord, fitDetailTitle } from "@/lib/seo/document-title";
import { projectSeoTitle, projectTitleName } from "@/lib/seo/project-meta";
import { assetSeoDescription, assetSeoTitle } from "@/lib/seo/detail";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { projectsDirectoryDescription } from "@/lib/projects/copy";
import {
  DESCRIPTION_MAX_CHARS,
  DESCRIPTION_MIN_CHARS,
  TITLE_MAX_CHARS,
  assetsDirectoryDescription,
  pageDescriptionLength,
  pageTitleLength,
} from "@/lib/site";

describe("detail titles", () => {
  it("drops the region before it shortens the name", () => {
    const title = fitDetailTitle(
      "Perham Down - Meadow Solar Farm & Battery Storage",
      "consented",
      "South East",
    );
    expect(pageTitleLength(title)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(title.endsWith(" | Grid")).toBe(true);
    expect(title).not.toContain("South East");
    expect(title).toContain("consented");
  });

  it("keeps the distinctive project name and does not cut a word", () => {
    expect(projectTitleName("Eurocell Nickel, High View Road - Solar Pv System")).toBe("Eurocell Nickel");
    const eurocell = loadProjectCatalogue().projects.find((project) => project.name.includes("Eurocell Nickel"));
    expect(eurocell).toBeDefined();
    if (!eurocell) {
      return;
    }
    const title = projectSeoTitle(eurocell);
    expect(title).toBe("Eurocell Nickel solar, East Midlands: in planning | Grid");
    expect(pageTitleLength(title)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    expect(title).not.toContain("Solar…");
    expect(title).not.toContain("High View Road");

    const original = "Perham Down Meadow Solar Farm And Battery Storage Project North";
    const long = fitDetailTitle(original, "in planning");
    expect(long).toBe("Perham Down Meadow Solar Farm And…: in planning | Grid");
    expect(pageTitleLength(long)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    const body = long.slice(0, long.indexOf("…"));
    expect(original.startsWith(body)).toBe(true);
    expect(original[body.length]).toBe(" ");
    expect(clipAtWord(original, 24)).toBe("Perham Down Meadow…");
  });

  it("keeps a short station title with capacity and region", () => {
    const title = assetSeoTitle({
      name: "Cuckoo Grove Farm",
      technology: "Solar PV",
      mw: 6.1,
      region: "South Wales",
    });
    expect(title).toBe("Cuckoo Grove Farm: 6.1 MW Solar PV, South Wales | Grid");
    expect(pageTitleLength(title)).toBeLessThanOrEqual(TITLE_MAX_CHARS);
  });

  it("builds directory descriptions from the catalogue counts", () => {
    const assets = assetsDirectoryDescription(loadAssetCatalogue().rows.length);
    const projects = projectsDirectoryDescription(loadProjectCatalogue().projects.length);
    expect(pageDescriptionLength(assets)).toBeGreaterThanOrEqual(DESCRIPTION_MIN_CHARS);
    expect(pageDescriptionLength(assets)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(pageDescriptionLength(projects)).toBeGreaterThanOrEqual(DESCRIPTION_MIN_CHARS);
    expect(pageDescriptionLength(projects)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
    expect(assets).toContain("interconnectors");
    expect(projects).toContain("NESO TEC register");
  });

  it("names the source on an asset description and stays within 155 characters", () => {
    const description = assetSeoDescription({
      name: "Cuckoo Grove Farm",
      technology: "Solar PV",
      mw: 6.1,
      region: "South Wales",
      operator: "Foresight",
      source: "REPD",
    });
    expect(description).toContain("DESNZ REPD");
    expect(description).toContain("operated by Foresight");
    expect(pageDescriptionLength(description)).toBeLessThanOrEqual(DESCRIPTION_MAX_CHARS);
  });
});
