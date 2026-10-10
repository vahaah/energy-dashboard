import { describe, expect, it } from "vitest";
import { mapElexonFuel, SNAPSHOT_FUELS, SNAPSHOT_STORAGE_FUELS } from "@/lib/ingest/fuels";

describe("mapElexonFuel", () => {
  it("keeps Hydro Pumped Storage out of hydro and maps battery when published", () => {
    expect(mapElexonFuel("Hydro Run-of-river and poundage")).toBe("hydro");
    expect(mapElexonFuel("Hydro Water Reservoir")).toBe("hydro");
    expect(mapElexonFuel("Hydro Pumped Storage")).toBe("pumped");
    expect(mapElexonFuel("Battery")).toBe("battery");
    expect(mapElexonFuel("Energy storage")).toBe("battery");
    expect(SNAPSHOT_FUELS).not.toContain("pumped");
    expect(SNAPSHOT_STORAGE_FUELS).toEqual(["pumped", "battery"]);
  });
});
