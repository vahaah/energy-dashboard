import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DNO_ATTRIBUTION, NESO_DNO_ACCURACY_WARNING, osBasemapAttribution } from "@/lib/map/constants";
import {
  CARBON_INTENSITY_API_URL,
  CARBON_INTENSITY_ATTRIBUTION,
  CARBON_INTENSITY_FORECAST_NOTE,
  CC_BY_4_0_LICENSE_URL,
  DATA_SOURCE_IDS,
  captionCarbon,
  captionGeneration,
  EIRGRID_GROUP_ATTRIBUTION,
  EIRGRID_GROUP_LICENCE_URL,
  ELEXON_BMRS_LICENCE_URL,
  elexonBmrsAttribution,
  elexonBmrsAttributionBlock,
  EIA_ATTRIBUTION,
  GEONAMES_ATTRIBUTION,
  NATIONAL_GAS_ATTRIBUTION,
  OGL_V3_ATTRIBUTION,
  OGL_V3_LICENCE_URL,
  NESO_EMBEDDED_FORECAST_RESOURCE_ID,
  NESO_EMBEDDED_FORECAST_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  PV_LIVE_ATTRIBUTION,
  WORLD_BANK_PINK_SHEET_ATTRIBUTION,
} from "@/lib/attribution";
import { readLinkCatalogue } from "@/lib/catalogue/links/catalogue";
import { cataloguePageSources, dataSources } from "@/lib/catalogue/page-sources";

describe("Elexon BMRS attribution", () => {
  it("uses the exact BMRS credit and licence URL", () => {
    expect(elexonBmrsAttribution(2026)).toBe(
      "Contains BMRS data © Elexon Limited copyright and database right 2026."
    );
    expect(ELEXON_BMRS_LICENCE_URL).toBe(
      "https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/"
    );
    expect(elexonBmrsAttributionBlock(2026)).toEqual({
      text: "Contains BMRS data © Elexon Limited copyright and database right 2026.",
      licence: ELEXON_BMRS_LICENCE_URL,
    });
  });

  it("credits NESO historic mix under the Open Data licence", () => {
    expect(NESO_OPEN_DATA_ATTRIBUTION).toBe("Supported by National Energy SO Open Data");
    expect(NESO_OPEN_DATA_LICENCE_URL).toContain("neso-open-data-licence");
    expect(NESO_EMBEDDED_FORECAST_URL).toContain("embedded-wind-and-solar-forecasts");
    expect(NESO_EMBEDDED_FORECAST_RESOURCE_ID).toBe("db6c038f-98af-4570-ab60-24d71ebd0ae5");
  });

  it("credits the Carbon Intensity API as CC BY 4.0 and forbids raw forecast republishing", () => {
    expect(CARBON_INTENSITY_API_URL).toBe("https://carbonintensity.org.uk/");
    expect(CARBON_INTENSITY_ATTRIBUTION).toContain("CC BY 4.0");
    expect(CARBON_INTENSITY_ATTRIBUTION).toContain("University of Oxford");
    expect(CARBON_INTENSITY_ATTRIBUTION).toContain("Environmental Defense Fund Europe");
    expect(CARBON_INTENSITY_ATTRIBUTION).not.toContain("EDF Energy");
    expect(CARBON_INTENSITY_ATTRIBUTION).toContain("WWF");
    expect(CARBON_INTENSITY_FORECAST_NOTE).toContain("raw forecast series is not republished");
    expect(CC_BY_4_0_LICENSE_URL).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(captionCarbon(false)).toBe(CARBON_INTENSITY_ATTRIBUTION);
    expect(captionCarbon(true)).toBe(`${NESO_OPEN_DATA_ATTRIBUTION}.`);
    expect(captionGeneration(true)).toBe(`${NESO_OPEN_DATA_ATTRIBUTION}.`);
    expect(captionGeneration(false, 2026)).toContain("Elexon Limited");
    expect(captionGeneration(false, 2026)).toContain(PV_LIVE_ATTRIBUTION);
  });

  it("lists every ingest source with its required attribution text", () => {
    expect(DATA_SOURCE_IDS).toEqual([
      "elexon-bmrs",
      "neso-open-data",
      "carbon-intensity",
      "sheffield-pv-live",
      "eia",
      "world-bank-pink-sheet",
      "national-gas",
      "desnz-repd",
      "desnz-dukes",
      "neso-dno-areas",
      "os-open-zoomstack",
      "eirgrid-group",
      "geonames",
    ]);
    const sources = dataSources(2026);
    expect(sources.map((source) => source.id)).toEqual([...DATA_SOURCE_IDS]);
    expect(sources.find((source) => source.id === "elexon-bmrs")?.attribution).toBe(
      elexonBmrsAttribution(2026)
    );
    expect(PV_LIVE_ATTRIBUTION).toContain("Sheffield Solar PV_Live");
    expect(EIA_ATTRIBUTION).toContain("Energy Information Administration");
    expect(WORLD_BANK_PINK_SHEET_ATTRIBUTION).toContain("CC BY 4.0");
    expect(NATIONAL_GAS_ATTRIBUTION).toBe(
      "Data sourced from the National Gas Transmission Data Portal.",
    );
    expect(sources.find((source) => source.id === "national-gas")?.attribution).toBe(
      "Data sourced from the National Gas Transmission Data Portal.",
    );
    expect(sources.find((source) => source.id === "national-gas")?.licence).toContain(
      "14 Oct 2026",
    );
    for (const id of ["desnz-repd", "desnz-dukes", "neso-dno-areas", "os-open-zoomstack"] as const) {
      const source = sources.find((item) => item.id === id);
      expect(source?.licenceUrl).toBe(OGL_V3_LICENCE_URL);
      expect(source?.licence).toContain("Open Government Licence v3.0");
    }
    expect(sources.find((source) => source.id === "desnz-repd")?.attribution).toBe(OGL_V3_ATTRIBUTION);
    expect(sources.find((source) => source.id === "desnz-dukes")?.attribution).toBe(OGL_V3_ATTRIBUTION);
    const dno = sources.find((source) => source.id === "neso-dno-areas");
    expect(dno?.attribution).toBe(DNO_ATTRIBUTION);
    expect(dno?.usedFor).toContain(NESO_DNO_ACCURACY_WARNING);
    expect(dno?.attribution).toContain("Open Government Licence v3.0");
    const zoomstack = sources.find((source) => source.id === "os-open-zoomstack");
    expect(sources.find((source) => source.id === "geonames")?.attribution).toBe(GEONAMES_ATTRIBUTION);
    expect(GEONAMES_ATTRIBUTION).toContain("CC BY 4.0");
    expect(zoomstack?.attribution).toBe(osBasemapAttribution(2026));
    expect(zoomstack?.usedFor).toContain("2026-06");
    const eirgrid = sources.find((source) => source.id === "eirgrid-group");
    expect(eirgrid?.attribution).toBe(EIRGRID_GROUP_ATTRIBUTION);
    expect(eirgrid?.licenceUrl).toBe(EIRGRID_GROUP_LICENCE_URL);
    expect(eirgrid?.licence).toContain("15 Oct 2026");
    expect(JSON.stringify(sources)).not.toMatch(/OilPriceAPI|TTF/);
  });

  it("passes GeoNames CC BY 4.0 through link pages and the data-sources list", () => {
    expect(cataloguePageSources().find((source) => source.id === "geonames")?.attribution).toBe(
      GEONAMES_ATTRIBUTION,
    );
    const links = readLinkCatalogue(process.cwd());
    const ifa = [...links.details.values()].find((detail) => detail.row.name === "IFA");
    const bacton = [...links.details.values()].find((detail) => detail.row.name === "Bacton IPs");
    expect(ifa?.link?.attributions).toContain(GEONAMES_ATTRIBUTION);
    expect(ifa?.link?.attributions.some((line) => line.includes("Elexon"))).toBe(true);
    expect(bacton?.link?.attributions).toEqual([NATIONAL_GAS_ATTRIBUTION, GEONAMES_ATTRIBUTION]);
    expect(bacton?.link?.sourceRecords.some((record) => record.source === "GeoNames")).toBe(true);
    expect(readFileSync(resolve(process.cwd(), "src/app/data-sources/page.tsx"), "utf8")).toContain(
      "cataloguePageSources()",
    );
  });
});
