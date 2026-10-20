import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/data-health/route";
import { API_ERROR_SCOPE, scopeRejection } from "@/lib/api/errors";
import { gbDataHealthReading, isGbDataHealthMetric } from "@/lib/metrics";

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
    expect(scopeRejection(new URLSearchParams("scope=GB&geography=NI"))).toEqual({
      status: 400,
      body: { error: API_ERROR_SCOPE },
    });
    expect(scopeRejection(new URLSearchParams("scope=NI&scope=NI"))).toEqual({
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
    const readings = [
      { metric_id: "elec.gb.demand.itsdo", value: 1 },
      { metric_id: "gas.gb_nts.demand.actual_volume", value: 2 },
      { metric_id: "commodity.gb_gas_sap.price", value: 3 },
      { metric_id: "commodity.henry_hub.spot", value: 4 },
      { metric_id: "elec.ni.carbon.intensity", value: 5 },
      { metric_id: "elec.ie.carbon.intensity", value: 6 },
      { metric_id: "elec.all_island.carbon.intensity", value: 7 },
    ].flatMap((reading) => {
      const row = gbDataHealthReading(reading);
      return row ? [row] : [];
    });
    expect(readings.map((reading) => reading.metric_id)).toEqual([
      "elec.gb.demand.itsdo",
      "gas.gb_nts.demand.actual_volume",
      "commodity.gb_gas_sap.price",
    ]);
    expect(readings.map((reading) => reading.geography_id)).toEqual(["GB", "GB_NTS", "GB_NTS"]);
  });

  it("filters GET /api/v1/data-health?scope=GB and rejects a conflicting scope", async () => {
    const conflict = await GET(new Request("http://localhost/api/v1/data-health?scope=GB&scope=NI"));
    expect(conflict.status).toBe(400);
    expect(await conflict.json()).toEqual({ error: API_ERROR_SCOPE });
    const response = await GET(new Request("http://localhost/api/v1/data-health?scope=GB"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { readings: Array<{ metric_id: string; geography_id: string }> };
    expect(body.readings.length).toBeGreaterThan(0);
    expect(body.readings.every((reading) => reading.geography_id === "GB" || reading.geography_id === "GB_NTS")).toBe(true);
    expect(body.readings.some((reading) => reading.metric_id.startsWith("elec.ni."))).toBe(false);
    expect(body.readings.some((reading) => reading.metric_id.startsWith("elec.ie."))).toBe(false);
    expect(body.readings.some((reading) => reading.metric_id.startsWith("elec.all_island."))).toBe(false);
    expect(body.readings.some((reading) => reading.metric_id === "commodity.henry_hub.spot")).toBe(false);
  });
});
