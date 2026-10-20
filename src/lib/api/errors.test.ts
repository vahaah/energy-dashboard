import { describe, expect, it } from "vitest";
import { API_ERROR_SCOPE, scopeRejection } from "@/lib/api/errors";
import { isGbDataHealthMetric } from "@/lib/metrics";

describe("scope rejection", () => {
  it("rejects a repeated value that is not GB", () => {
    expect(scopeRejection(new URLSearchParams("scope=GB&scope=NI"))).toEqual({
      status: 400,
      body: { error: API_ERROR_SCOPE },
    });
    expect(scopeRejection(new URLSearchParams("geography=GB&geography=NI"))).toEqual({
      status: 400,
      body: { error: API_ERROR_SCOPE },
    });
    expect(scopeRejection(new URLSearchParams("scope=GB&scope=GB"))).toBeNull();
    expect(scopeRejection(new URLSearchParams("scope=GB"))).toBeNull();
    expect(scopeRejection(new URLSearchParams())).toBeNull();
  });

  it("keeps GB electricity and GB gas on data-health", () => {
    expect(isGbDataHealthMetric("elec.gb.demand.itsdo")).toBe(true);
    expect(isGbDataHealthMetric("gas.gb_nts.demand.actual_volume")).toBe(true);
    expect(isGbDataHealthMetric("commodity.gb_gas_sap.price")).toBe(true);
    expect(isGbDataHealthMetric("commodity.henry_hub.spot")).toBe(false);
    expect(isGbDataHealthMetric("elec.ni.carbon.intensity")).toBe(false);
    expect(isGbDataHealthMetric("elec.ie.carbon.intensity")).toBe(false);
    expect(isGbDataHealthMetric("elec.all_island.carbon.intensity")).toBe(false);
    expect(isGbDataHealthMetric("energy.uk.final_consumption.industry")).toBe(false);
  });
});
