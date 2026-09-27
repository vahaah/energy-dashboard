import { describe, expect, it } from "vitest";
import { FUELINST_LABELS, INTERCONNECTOR_LABELS } from "@/lib/colors";

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
});
