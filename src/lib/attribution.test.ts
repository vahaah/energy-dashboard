import { describe, expect, it } from "vitest";
import {
  ELEXON_BMRS_LICENCE_URL,
  elexonBmrsAttribution,
  elexonBmrsAttributionBlock,
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
});
