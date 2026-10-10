import { describe, expect, it } from "vitest";
import {
  formatNesoOfficialLine,
  HIDE_SOLAR_RECORD,
  NESO_OFFICIAL_RECORDS,
} from "@/data/neso-official-records";

describe("NESO official records", () => {
  it("hard-codes the published wind and solar figures and hides solar", () => {
    expect(HIDE_SOLAR_RECORD).toBe(true);
    expect(NESO_OFFICIAL_RECORDS.wind).toMatchObject({ kind: "official", value: 23_880 });
    expect(NESO_OFFICIAL_RECORDS.solar).toMatchObject({ kind: "official", value: 15_158 });
    expect(NESO_OFFICIAL_RECORDS.wind.checkedAt).toBe("2026-10-10");
    expect(formatNesoOfficialLine(NESO_OFFICIAL_RECORDS.wind)).toBe(
      "NESO official record: 23,880 MW, 25 Mar 2026, 13:30 (source: NESO)"
    );
  });
});
