import { describe, expect, it } from "vitest";
import {
  CARD_LABEL_COLOR,
  COMMODITY_CARD_LABELS,
  COMMODITY_DISPLAY_ORDER,
  COMMODITY_LABELS,
  contrastRatio,
  DARK_SURFACE,
  DEMAND_SERIES_COLOR,
  DEMAND_SERIES_COLOR_DARK,
  DOMESTIC_GENERATION_SERIES_COLOR,
  DOMESTIC_GENERATION_SERIES_COLOR_DARK,
  LIGHT_CARD_LABEL,
  LIGHT_SURFACE,
  FUEL_COLORS,
  FUELINST_COLORS,
  FUELINST_LABELS,
  hexHue,
  INTERCONNECTOR_LABELS,
  relativeLuminance,
} from "@/lib/colors";
import { PUBLIC_COMMODITIES } from "@/lib/commodity-series";

describe("user-facing fuel labels", () => {
  it("labels PV Live as total GB solar, not embedded-only", () => {
    expect(FUELINST_LABELS.embedded_solar).toBe("Solar (PV Live estimate)");
  });

  it("labels interconnectors by the country they actually connect", () => {
    expect(INTERCONNECTOR_LABELS.intirl).toBe("Northern Ireland (Moyle)");
    expect(INTERCONNECTOR_LABELS.intelec).toBe("France (ElecLink)");
    expect(INTERCONNECTOR_LABELS.intgrnl).toBe("Ireland (Greenlink)");
    expect(INTERCONNECTOR_LABELS.intew).toBe("Ireland (East-West)");
    expect(INTERCONNECTOR_LABELS.intfr).toBe("France (IFA)");
    expect(INTERCONNECTOR_LABELS.intifa2).toBe("France (IFA2)");
    expect(INTERCONNECTOR_LABELS.intned).toBe("Netherlands (BritNed)");
    expect(INTERCONNECTOR_LABELS.intnem).toBe("Belgium (Nemo)");
    expect(INTERCONNECTOR_LABELS.intnsl).toBe("Norway (NSL)");
    expect(INTERCONNECTOR_LABELS.intvkl).toBe("Denmark (Viking Link)");
  });

  it("only labels the public oil and gas series, with no TTF, JKM or IMF", () => {
    expect(COMMODITY_DISPLAY_ORDER).toEqual(PUBLIC_COMMODITIES);
    expect(Object.keys(COMMODITY_LABELS)).toEqual([...PUBLIC_COMMODITIES]);
    expect(COMMODITY_LABELS.brent_crude).toBe("Brent crude ($/bbl)");
    expect(COMMODITY_CARD_LABELS.brent_crude).toBe("Brent crude oil");
    expect(COMMODITY_LABELS.lng_asia).toBe("LNG, Japan import price (World Bank, monthly)");
    expect(COMMODITY_LABELS.eu_natural_gas).toBe("Natural gas, Europe (World Bank, monthly)");
    expect(COMMODITY_LABELS).not.toHaveProperty("eu_ttf");
    expect(`${Object.values(COMMODITY_LABELS).join("\n")}\n${Object.values(COMMODITY_CARD_LABELS).join("\n")}`).not.toMatch(
      /TTF|JKM|IMF/
    );
  });
});

describe("shared fuel palette", () => {
  it("uses one hex per fuel across FUEL_COLORS and FUELINST_COLORS", () => {
    expect(FUELINST_COLORS.wind).toBe(FUEL_COLORS.wind);
    expect(FUELINST_COLORS.embedded_wind).toBe(FUEL_COLORS.embedded_wind);
    expect(FUELINST_COLORS.ccgt).toBe(FUEL_COLORS.gas);
    expect(FUELINST_COLORS.ocgt).toBe(FUEL_COLORS.gas);
    expect(FUEL_COLORS.wind).not.toBe(FUEL_COLORS.embedded_wind);
    expect(relativeLuminance(FUEL_COLORS.embedded_wind)).toBeGreaterThan(
      relativeLuminance(FUEL_COLORS.wind)
    );
  });
});

describe("non-fuel series colours", () => {
  it("does not reuse a fuel colour for demand or domestic generation", () => {
    const fuelHex = new Set([
      ...Object.values(FUEL_COLORS),
      ...Object.values(FUELINST_COLORS),
    ]);

    expect(fuelHex.has(DEMAND_SERIES_COLOR)).toBe(false);
    expect(fuelHex.has(DOMESTIC_GENERATION_SERIES_COLOR)).toBe(false);
  });

  it("keeps demand and generation as neutrals with AA contrast in both themes", () => {
    expect(hexHue(DEMAND_SERIES_COLOR)).toBe(0);
    expect(hexHue(DOMESTIC_GENERATION_SERIES_COLOR)).toBe(0);
    expect(contrastRatio(DEMAND_SERIES_COLOR, LIGHT_SURFACE)).toBeGreaterThan(4.5);
    expect(contrastRatio(DEMAND_SERIES_COLOR_DARK, DARK_SURFACE)).toBeGreaterThan(4.5);
    expect(contrastRatio(DOMESTIC_GENERATION_SERIES_COLOR, LIGHT_SURFACE)).toBeGreaterThan(4.5);
    expect(contrastRatio(DOMESTIC_GENERATION_SERIES_COLOR_DARK, DARK_SURFACE)).toBeGreaterThan(4.5);
  });

  it("gives card titles AA contrast at text-xs on both surfaces", () => {
    expect(contrastRatio(CARD_LABEL_COLOR, DARK_SURFACE)).toBeGreaterThan(4.5);
    expect(contrastRatio(LIGHT_CARD_LABEL, LIGHT_SURFACE)).toBeGreaterThan(4.5);
  });
});
