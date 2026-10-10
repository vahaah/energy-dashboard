import { describe, expect, it } from "vitest";
import {
  CARBON_INTENSITY_API_URL,
  CARBON_INTENSITY_ATTRIBUTION,
  CARBON_INTENSITY_FORECAST_NOTE,
  ELEXON_BMRS_LICENCE_URL,
  elexonBmrsAttribution,
  elexonBmrsAttributionBlock,
  NESO_EMBEDDED_FORECAST_RESOURCE_ID,
  NESO_EMBEDDED_FORECAST_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
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
    expect(CARBON_INTENSITY_FORECAST_NOTE).toContain("raw forecast series is not republished");
  });
});
