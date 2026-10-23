import { describe, expect, it } from "vitest";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { fitDetailTitle } from "@/lib/seo/document-title";
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
