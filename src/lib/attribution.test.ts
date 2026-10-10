import { describe, expect, it } from "vitest";
import {
  CARBON_INTENSITY_API_URL,
  CARBON_INTENSITY_ATTRIBUTION,
  CARBON_INTENSITY_FORECAST_NOTE,
  CC_BY_4_0_LICENSE_URL,
  DATA_SOURCE_IDS,
  captionCarbon,
  dataSources,
  ELEXON_BMRS_LICENCE_URL,
  elexonBmrsAttribution,
  elexonBmrsAttributionBlock,
  EIA_ATTRIBUTION,
  NATIONAL_GAS_ATTRIBUTION,
  NESO_EMBEDDED_FORECAST_RESOURCE_ID,
  NESO_EMBEDDED_FORECAST_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  PV_LIVE_ATTRIBUTION,
  WORLD_BANK_PINK_SHEET_ATTRIBUTION,
} from "@/lib/attribution";

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
    ]);
    const sources = dataSources(2026);
    expect(sources.map((source) => source.id)).toEqual([...DATA_SOURCE_IDS]);
    expect(sources.find((source) => source.id === "elexon-bmrs")?.attribution).toBe(
      elexonBmrsAttribution(2026)
    );
    expect(PV_LIVE_ATTRIBUTION).toContain("Sheffield Solar PV_Live");
    expect(EIA_ATTRIBUTION).toContain("Energy Information Administration");
    expect(WORLD_BANK_PINK_SHEET_ATTRIBUTION).toContain("CC BY 4.0");
    expect(NATIONAL_GAS_ATTRIBUTION).toContain("PUBOB603");
  });
});
