import { describe, expect, it } from "vitest";
import {
  COMMODITY_CARD_LABELS,
  COMMODITY_DISPLAY_ORDER,
  COMMODITY_LABELS,
  FUELINST_LABELS,
  INTERCONNECTOR_LABELS,
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

  it("uses IMF labels for the public FRED series and never names TTF or JKM", () => {
    expect(COMMODITY_DISPLAY_ORDER).toEqual(PUBLIC_COMMODITIES);
    expect(COMMODITY_LABELS.eu_natural_gas).toBe("EU gas, monthly (IMF)");
    expect(COMMODITY_LABELS.lng_asia).toBe("Asian LNG, Japan import price (IMF, monthly)");
    expect(COMMODITY_CARD_LABELS.eu_natural_gas).toBe("EU gas, monthly (IMF)");
    expect(COMMODITY_CARD_LABELS.lng_asia).toBe("Asian LNG, Japan import price (IMF, monthly)");
    expect(COMMODITY_LABELS.brent_crude).toBe("Brent crude ($/bbl)");
    expect(COMMODITY_CARD_LABELS.brent_crude).toBe("Brent crude oil");
    expect(`${Object.values(COMMODITY_LABELS).join("\n")}\n${Object.values(COMMODITY_CARD_LABELS).join("\n")}`).not.toMatch(
      /TTF|JKM/
    );
  });
});
