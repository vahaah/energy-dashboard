import { describe, expect, it } from "vitest";
import { assessPublication } from "@/lib/data-state";
import { EIRGRID_METRICS, staleGrace } from "@/lib/metrics";

describe("EirGrid freshness", () => {
  it("gives SEMO imbalance 1.5h and lets carbon ride out a gap that is not a multi-hour outage", () => {
    const price = EIRGRID_METRICS["elec.all_island.price.imbalance"];
    const volume = EIRGRID_METRICS["elec.all_island.imbalance.volume"];
    expect(price.publication_lag).toBe("PT1H30M");
    expect(staleGrace(price)).toBe("PT2H30M");
    expect(volume.publication_lag).toBe("PT1H30M");
    expect(staleGrace(volume)).toBe("PT2H30M");
    expect(EIRGRID_METRICS["elec.ni.demand.system"].publication_lag).toBe("PT0S");
    expect(staleGrace(EIRGRID_METRICS["elec.ni.demand.system"])).toBe("PT1H");

    const period = "2026-10-21T00:30:00.000Z";
    const priceInput = {
      value: 36.63,
      publishedAt: period,
      retrievedAt: "2026-10-21T02:15:00.000Z",
      expectedCadence: price.expected_cadence,
      publicationLag: staleGrace(price),
    };
    expect(assessPublication({ ...priceInput, now: new Date("2026-10-21T02:30:00.000Z") }).stale).toBe(false);
    expect(assessPublication({ ...priceInput, now: new Date("2026-10-21T03:30:00.000Z") }).stale).toBe(false);
    expect(
      assessPublication({ ...priceInput, now: new Date(Date.parse("2026-10-21T03:30:00.000Z") + 1) }).stale,
    ).toBe(true);

    for (const metricId of [
      "elec.ni.carbon.intensity",
      "elec.ie.carbon.intensity",
      "elec.all_island.carbon.intensity",
    ] as const) {
      const carbon = EIRGRID_METRICS[metricId];
      expect(carbon.publication_lag).toBe("PT1H30M");
      expect(staleGrace(carbon)).toBe("PT2H45M");
      const publishedAt = "2026-10-21T00:45:00.000Z";
      const input = {
        value: 112,
        publishedAt,
        retrievedAt: "2026-10-21T02:15:00.000Z",
        expectedCadence: carbon.expected_cadence,
        publicationLag: staleGrace(carbon),
      };
      expect(assessPublication({ ...input, now: new Date("2026-10-21T02:45:00.000Z") }).stale).toBe(false);
      expect(assessPublication({ ...input, now: new Date("2026-10-21T03:45:00.000Z") }).stale).toBe(false);
      expect(
        assessPublication({ ...input, now: new Date(Date.parse("2026-10-21T03:45:00.000Z") + 1) }).stale,
      ).toBe(true);
    }
  });
});
