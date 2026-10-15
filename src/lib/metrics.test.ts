import { describe, expect, it } from "vitest";
import { DATA_SOURCE_IDS } from "@/lib/attribution";
import {
  homepageDemandFigureInputs,
  isGeographyId,
  METRICS,
  metricProvenance,
  metricSourceIds,
  RECORD_METRICS,
} from "@/lib/metrics";
import type { MetricDefinition, Observation } from "@/lib/types";

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
    for (const id of [
      "GB",
      "NI",
      "UK",
      "IE",
      "ALL_ISLAND",
      "GB_NTS",
      "GB_DNO_10",
      "GB_DNO_0",
      "GB_GSP_ABHA",
      "ONS_LAD_E09000001",
      "US",
      "NW_EUROPE",
      "JP",
      "GLOBAL",
    ]) {
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
      "WORLD",
      "EU",
      "EUROPE",
      "ASIA",
      "USA",
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

  it("waits out each publisher's lag before calling a price stale", () => {
    expect(METRICS["commodity.gb_gas_sap.price"].publication_lag).toBe("P2D");
    expect(METRICS["commodity.eu_natural_gas.spot"].publication_lag).toBe("P1M");
    expect(METRICS["commodity.lng_asia.spot"].publication_lag).toBe("P1M");
    expect(METRICS["commodity.brent.spot"].publication_lag).toBe("P10D");
    expect(METRICS["commodity.wti.spot"].publication_lag).toBe("P10D");
    expect(METRICS["commodity.henry_hub.spot"].publication_lag).toBe("P10D");
    expect(METRICS["elec.gb.demand.itsdo"].publication_lag).toBe("PT0S");
    expect(METRICS["elec.gb.generation.battery"].publication_lag).toBe("PT0S");
    expect(METRICS["elec.gb.price.imbalance"].publication_lag).toBe("PT30M");
  });

  it("tags commodity markets with their own geography", () => {
    expect(METRICS["commodity.brent.spot"].geography_id).toBe("GLOBAL");
    expect(METRICS["commodity.wti.spot"].geography_id).toBe("US");
    expect(METRICS["commodity.henry_hub.spot"].geography_id).toBe("US");
    expect(METRICS["commodity.eu_natural_gas.spot"].geography_id).toBe("NW_EUROPE");
    expect(METRICS["commodity.lng_asia.spot"].geography_id).toBe("JP");
    expect(METRICS["commodity.gb_gas_sap.price"].geography_id).toBe("GB_NTS");
  });

  it("registers the homepage Market Index and imbalance price", () => {
    expect(METRICS["elec.gb.price.market_index"]).toMatchObject({
      unit: "£/MWh",
      dataset_id: "APXMIDP",
      source_id: "elexon-bmrs",
      geography_id: "GB",
      aggregation: "last",
      quantity_kind: "index",
    });
    expect(METRICS["elec.gb.price.market_index"].coverage).toContain("price_mid_gbp_mwh");
    expect(METRICS["elec.gb.price.imbalance"]).toMatchObject({
      unit: "£/MWh",
      dataset_id: "system-prices",
      source_id: "elexon-bmrs",
      geography_id: "GB",
      aggregation: "last",
    });
    expect(METRICS["elec.gb.price.imbalance"].coverage).toContain("price_gbp_mwh");
  });
});

describe("record metrics", () => {
  it("states source, start date, interval and method", () => {
    const line = metricProvenance(RECORD_METRICS.wind);
    expect(RECORD_METRICS.renewable_share.id).toBe("renewable_share");
    expect(line).toContain("NESO historic generation mix");
    expect(line).toContain("From 1 Jan 2009");
    expect(line).toContain("Half-hour");
    expect(line).toContain(RECORD_METRICS.wind.method);
    expect(metricProvenance(RECORD_METRICS.coal_end)).toContain("From 30 Sep 2024");
    expect(metricProvenance(RECORD_METRICS.coal_end)).toContain("Day");
    expect(RECORD_METRICS.renewable_share.method).toContain("wind, solar and hydro");
  });
});
