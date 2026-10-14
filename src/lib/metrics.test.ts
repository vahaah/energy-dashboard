import { describe, expect, it } from "vitest";
import { DATA_SOURCE_IDS } from "@/lib/attribution";
import {
  homepageDemandFigureInputs,
  isGeographyId,
  METRICS,
  metricSourceIds,
  type MetricDefinition,
  type Observation,
} from "@/lib/metrics";

const REGISTERED: MetricDefinition[] = Object.values(METRICS);

function isPercentOrShare(metric: MetricDefinition): boolean {
  return metric.quantity_kind === "share" || metric.unit.includes("%") || /percent/i.test(metric.unit);
}

describe("metric registry", () => {
  it("snapshots the homepage demand figure inputs", () => {
    expect(homepageDemandFigureInputs()).toMatchInlineSnapshot(`
      {
        "displayUnit": "GW",
        "geography_id": "GB",
        "metric_id": "elec.gb.demand.itsdo",
        "source": "Elexon BMRS",
        "unit": "MW",
      }
    `);
  });

  it("fails if a rate metric has aggregation sum", () => {
    const illegal = REGISTERED.filter(
      (metric) => metric.quantity_kind === "instantaneous_rate" && metric.aggregation === "sum"
    );
    expect(illegal.map((metric) => metric.metric_id)).toEqual([]);
  });

  it("fails if a percent or share metric lacks a denominator", () => {
    const missing = REGISTERED.filter(
      (metric) => isPercentOrShare(metric) && (metric.denominator == null || metric.denominator.trim() === "")
    );
    expect(missing.map((metric) => metric.metric_id)).toEqual([]);
  });

  it("keeps wind, solar and hydro as a share of headline generation", () => {
    const share = METRICS["elec.gb.share.wind_solar_hydro"];
    expect(share.denominator).toBe("elec.gb.generation.balance");
    expect(share.quantity_kind).toBe("share");
    expect(share.unit).toBe("%");
    expect(METRICS["elec.gb.generation.balance"].quantity_kind).toBe("instantaneous_rate");
    expect(share.coverage).toContain("Transmission wind");
    expect(share.coverage).toContain("embedded wind");
    expect(share.coverage).toContain("PV Live solar");
    expect(share.coverage).toContain("conventional hydro");
    expect(share.coverage).toContain("biomass");
    expect(share.coverage).toContain("pumped storage");
    expect(share.coverage).toContain("battery");
    expect(share.coverage).toContain("imports");
    expect(Object.hasOwn(METRICS, "elec.gb.share.low_carbon")).toBe(false);
  });

  it("keeps positive FUELINST INT* as an import series of its own", () => {
    const imports = METRICS["elec.gb.imports.fuelinst"];
    expect(imports.sign_convention).toBe("positive_import_to_gb");
    expect(imports.dataset_id).toBe("FUELINST");
    expect(imports.metric_id).not.toBe(METRICS["elec.gb.generation.gas"].metric_id);
  });

  it("uses attribution source slugs and dotted ids", () => {
    const ids = new Set<string>();
    for (const metric of REGISTERED) {
      expect(ids.has(metric.metric_id), metric.metric_id).toBe(false);
      ids.add(metric.metric_id);
      expect(metric.metric_id).toMatch(/^[a-z0-9]+(?:\.[a-z0-9_]+)+$/);
      expect(isGeographyId(metric.geography_id)).toBe(true);
      for (const sourceId of metricSourceIds(metric)) {
        expect(DATA_SOURCE_IDS).toContain(sourceId);
      }
    }
  });

  it("types an observation without constructing one in the app", () => {
    const observation = {
      interval_start: "2026-10-14T11:00:00.000Z",
      interval_end: "2026-10-14T11:30:00.000Z",
      period_label: "23",
      time_basis: "uk_settlement_period",
      value: null,
      observation_kind: "actual",
      publication_status: "provisional",
      forecast_issued_at: null,
      published_at: null,
      retrieved_at: null,
      source_release_id: null,
      source_record_key: null,
      quality_flags: [],
    } satisfies Observation;

    expect(observation.interval_end > observation.interval_start).toBe(true);
    expect(observation.value).toBeNull();
  });
});

describe("geography enum", () => {
  it("accepts the closed geography ids", () => {
    for (const id of ["GB", "NI", "UK", "IE", "ALL_ISLAND", "GB_NTS", "GB_DNO_10", "GB_DNO_0", "GB_GSP_ABHA", "ONS_LAD_E09000001"]) {
      expect(isGeographyId(id), id).toBe(true);
    }
  });

  it("rejects national and anything outside the enum", () => {
    for (const id of [
      "national",
      "National",
      "GB_NATIONAL",
      "GB_national_demand",
      "NATIONAL",
      "US",
      "WORLD",
      "EU",
      "JP",
      "GB_DNO_",
      "GB_DNO_n",
      "GB_GSP_",
      "ONS_LAD",
      "ONS__E09000001",
      "",
      "gb",
    ]) {
      expect(isGeographyId(id), id).toBe(false);
    }
  });
});
