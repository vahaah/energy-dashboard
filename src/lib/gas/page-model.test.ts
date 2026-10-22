import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GAS_LDZ_HEADING,
  GAS_LDZ_NOTE,
  GAS_STORAGE_NOTICE,
  GAS_SYSTEM_STANDFIRST,
  bannedGasPhrases,
  entryAtTerminal,
} from "@/lib/gas/copy";
import { basisState, buildGasDocument, generationSamples, sameBasisComparison, visibleGasBases } from "@/lib/gas/page-model";
import { gasReleasePath } from "@/lib/ingest/national-gas/check";
import { gasDayFromLabel } from "@/lib/ingest/national-gas/gas-day";
import { DEMAND_PART_NAMES } from "@/lib/ingest/national-gas/instantaneous";
import { gasReleaseSchema, type GasComponent, type GasInstantaneousSample, type GasRelease } from "@/lib/ingest/national-gas/release";
import { formatLondonDayMonthYear } from "@/lib/london-time";
import type { Generation5min } from "@/lib/types";

const NOW = new Date("2026-10-15T06:52:00.000Z");

function rateAt(applicableAt: string): GasComponent {
  return {
    publication_id: "PUBOB2042",
    metric_id: "gas.gb_nts.entry.physical.national",
    name: "System Entry Flows, National, Physical",
    unit: "mscm/d",
    quantity_kind: "rate",
    basis: "flow",
    value: 100,
    counts: false,
    applicable_at: applicableAt,
    published_at: applicableAt,
    retrieved_at: applicableAt,
    forecast_issued_at: null,
    parent_publication_id: null,
  };
}

function fixtureRelease(): GasRelease {
  return gasReleaseSchema.parse(JSON.parse(readFileSync(gasReleasePath(), "utf8")));
}

describe("gas page model", () => {
  it("hides bases the release did not validate", () => {
    const release = fixtureRelease();
    expect(visibleGasBases(release.bases)).toEqual(["flow", "completed"]);
    expect(visibleGasBases(["flow"])).toEqual(["flow"]);
    expect(visibleGasBases(["to-date"])).toEqual(["to-date"]);
    expect(visibleGasBases(["estimate", "nominated"])).toEqual([]);
  });

  it("labels a short flow series partial and a finished day total complete", () => {
    const release = fixtureRelease();
    expect(basisState(release, "flow", NOW)).toBe("partial");
    expect(basisState(release, "completed", NOW)).toBe("complete");
    const document = buildGasDocument([release], NOW, null);
    expect(document.available).toBe(true);
    if (!document.available) {
      return;
    }
    const flow = document.slices.find((slice) => slice.basis === "flow");
    const completed = document.slices.find((slice) => slice.basis === "completed");
    expect(flow?.state).toBe("partial");
    expect(flow?.partialText).toContain("This gas day is not complete");
    expect(flow?.partialText).toContain("Compare with past days on the same basis.");
    expect(flow?.staleText).toMatch(/^Latest gas data is from .+ Grid checks every hour\.$/);
    expect(flow?.stamp.publishedAt).toBe("2026-10-14T03:05:00.000Z");
    expect(flow?.dayLabel).toBe("Gas day 13 Oct 2026, 05:00–05:00 BST");
    expect(completed?.state).toBe("complete");
    expect(completed?.partialText).toBeNull();
    expect(completed?.bases).toEqual(["flow", "completed"]);
  });

  it("reconciles entry and demand shares to 100", () => {
    const document = buildGasDocument([fixtureRelease()], NOW, null);
    if (!document.available) {
      throw new Error("fixture release missing");
    }
    const flow = document.slices.find((slice) => slice.basis === "flow");
    const completed = document.slices.find((slice) => slice.basis === "completed");
    expect(flow?.entry.map((row) => row.publicationId)).toEqual(["PUBOB2043", "PUBOB2044"]);
    expect(flow?.entry.reduce((total, row) => total + row.percent, 0)).toBe(100);
    expect(completed?.demand.reduce((total, row) => total + row.percent, 0)).toBe(100);
    const ldz = completed?.demand.find((row) => row.publicationId === "PUBOBJ1015");
    expect(ldz?.label).toBe(GAS_LDZ_HEADING);
    expect(ldz?.note).toBe(GAS_LDZ_NOTE);
    expect(completed?.storage.notice).toBe(GAS_STORAGE_NOTICE);
    expect(completed?.linepack.description).toBe("Gas held in the pipelines");
    expect(completed?.linepack.opening).not.toBe("—");
    expect(completed?.demand.every((row) => row.unit === "million m³")).toBe(true);
    expect(flow?.entry.every((row) => row.unit === "million m³/day")).toBe(true);
    expect(completed?.stats.map((stat) => stat.unit)).toEqual([
      "million m³",
      "million m³",
      "million m³",
      "million m³",
    ]);
    expect(completed?.storage.unit).toBe("million m³");
    expect(completed?.staleText).toBeNull();
  });

  it("never compares a partial day with a complete day on a different basis", () => {
    const partial = { day: "2026-10-14", basis: "flow" as const };
    const completeOtherBasis = { day: "2026-10-13", basis: "completed" as const };
    const completeSameBasis = { day: "2026-10-12", basis: "flow" as const };
    expect(sameBasisComparison(partial, [partial, completeOtherBasis, completeSameBasis])).toEqual([
      completeSameBasis,
    ]);

    const release = fixtureRelease();
    const flowOnly: GasRelease = {
      ...release,
      gas_day: gasDayFromLabel("2026-10-12"),
      bases: ["flow"],
      components: [],
    };
    const document = buildGasDocument([release, flowOnly], NOW, null);
    if (!document.available) {
      throw new Error("fixture release missing");
    }
    const completed = document.slices.find((slice) => slice.day === "2026-10-13" && slice.basis === "completed");
    expect(completed?.comparison.map((row) => row.day)).not.toContain("2026-10-12");
    expect(completed?.comparison.every((row) => row.basis === "completed")).toBe(true);
    const flow = document.slices.find((slice) => slice.day === "2026-10-13" && slice.basis === "flow");
    expect(flow?.comparison.map((row) => row.basis)).toEqual(["flow"]);
    expect(flow?.comparison.map((row) => row.day)).toEqual(["2026-10-12"]);
  });

  it("drops actuals after now and keeps the forecast dashed series", () => {
    const release = fixtureRelease();
    const forecast: GasComponent = {
      publication_id: "PUBOB19",
      metric_id: "gas.gb_nts.entry.forecast",
      name: "System Entry Flows, National, Forecast",
      unit: "mscm/d",
      quantity_kind: "forecast",
      basis: "flow",
      value: 160,
      counts: false,
      applicable_at: "2026-10-14T02:00:00.000Z",
      published_at: "2026-10-14T02:15:00.000Z",
      retrieved_at: "2026-10-15T05:22:00.000Z",
      forecast_issued_at: "2026-10-14T02:00:00.000Z",
      parent_publication_id: null,
    };
    const withForecast: GasRelease = { ...release, components: [...release.components, forecast] };
    const now = new Date("2026-10-14T01:30:00.000Z");
    const document = buildGasDocument([withForecast], now, null);
    if (!document.available) {
      throw new Error("fixture release missing");
    }
    const flow = document.slices.find((slice) => slice.basis === "flow");
    expect(flow?.now).toBe(now.toISOString());
    expect(flow?.series.some((point) => point.supplyForecast === 160)).toBe(true);
    expect(flow?.series.filter((point) => point.supply != null).every((point) => point.at <= now.toISOString())).toBe(true);
    expect(flow?.series.some((point) => point.at > now.toISOString() && point.supply != null)).toBe(false);
  });

  it("shows the electricity bridge only when both timestamps fall in the gas day", () => {
    const release = fixtureRelease();
    const outside: Generation5min[] = [
      { timestamp: "2026-10-15 06:00:00", fuel_type: "ccgt", generation_mw: 8000, source: "fuelinst" },
    ];
    const hidden = buildGasDocument([release], NOW, outside);
    if (!hidden.available) {
      throw new Error("fixture release missing");
    }
    expect(hidden.slices.every((slice) => slice.bridge == null)).toBe(true);

    const inside: Generation5min[] = [
      { timestamp: "2026-10-13 12:00:00", fuel_type: "ccgt", generation_mw: 6000, source: "fuelinst" },
      { timestamp: "2026-10-13 12:00:00", fuel_type: "ocgt", generation_mw: 400, source: "fuelinst" },
      { timestamp: "2026-10-13 13:00:00", fuel_type: "wind", generation_mw: 9000, source: "fuelinst" },
    ];
    expect(generationSamples(inside)).toEqual([{ at: "2026-10-13T12:00:00.000Z", mw: 6400 }]);
    const fragment = buildGasDocument([release], NOW, inside);
    if (!fragment.available) {
      throw new Error("fixture release missing");
    }
    expect(fragment.slices.every((slice) => slice.bridge == null)).toBe(true);

    const covered: Generation5min[] = [];
    for (let at = Date.parse(release.gas_day.start); at < Date.parse(release.gas_day.end); at += 30 * 60 * 1000) {
      const timestamp = new Date(at).toISOString();
      covered.push(
        { timestamp, fuel_type: "ccgt", generation_mw: 6000, source: "fuelinst" },
        { timestamp, fuel_type: "ocgt", generation_mw: 400, source: "fuelinst" },
      );
    }
    const shown = buildGasDocument([release], NOW, covered);
    if (!shown.available) {
      throw new Error("fixture release missing");
    }
    const bridge = shown.slices.find((slice) => slice.basis === "completed")?.bridge;
    expect(bridge?.offtake.unit).toBe("million m³");
    expect(bridge?.generation.unit).toBe("GW");
    expect(bridge?.generation.valueLabel).toBe("6.4");
    expect(bridge?.offtake.at).not.toBe(bridge?.generation.at);
    expect(bridge?.period).toContain("Gas day");
    expect(JSON.stringify(bridge)).not.toMatch(/\befficiency\b|\bratio\b/i);
  });

  it("labels both zones on a 23-hour and a 25-hour gas day", () => {
    const release = fixtureRelease();
    const spring = buildGasDocument(
      [{ ...release, gas_day: gasDayFromLabel("2026-03-28"), bases: ["completed"], components: [] }],
      NOW,
      null,
    );
    const autumn = buildGasDocument(
      [{ ...release, gas_day: gasDayFromLabel("2026-10-24"), bases: ["completed"], components: [] }],
      NOW,
      null,
    );
    if (!spring.available || !autumn.available) {
      throw new Error("clock-change release missing");
    }
    expect(spring.slices[0]?.dayLabel).toBe("Gas day 28 Mar 2026, 05:00 GMT–05:00 BST");
    expect(autumn.slices[0]?.dayLabel).toBe("Gas day 24 Oct 2026, 05:00 BST–05:00 GMT");
  });

  it("treats the last hourly sample as coverage and still requires the whole day", () => {
    const release = fixtureRelease();
    const start = Date.parse(release.gas_day.start);
    const end = Date.parse(release.gas_day.end);
    const rates: GasComponent[] = [];
    for (let at = start; at < end; at += 60 * 60 * 1000) {
      rates.push(rateAt(new Date(at + 5_000).toISOString()));
    }
    const full: GasRelease = { ...release, bases: ["flow"], components: rates };
    expect(basisState(full, "flow", NOW)).toBe("complete");
    const withoutLast = rates.filter((row) => Date.parse(row.applicable_at) < end - 60 * 60 * 1000);
    expect(basisState({ ...full, components: withoutLast }, "flow", NOW)).toBe("partial");
    expect(basisState(release, "flow", NOW)).toBe("partial");
  });

  it("keeps a completed day partial until both headline totals exist", () => {
    const release = fixtureRelease();
    const childOnly: GasRelease = {
      ...release,
      components: release.components.filter((row) => row.publication_id === "PUBOBJ1016"),
    };
    expect(basisState(childOnly, "completed", NOW)).toBe("partial");
  });

  it("uses the day-total cadence for completed staleness and the hourly cadence for flow", () => {
    const release = fixtureRelease();
    const recent = new Date("2026-10-14T16:00:00.000Z");
    const document = buildGasDocument([release], recent, null);
    if (!document.available) {
      throw new Error("fixture release missing");
    }
    const completed = document.slices.find((slice) => slice.basis === "completed");
    const flow = document.slices.find((slice) => slice.basis === "flow");
    expect(completed?.staleText).toBeNull();
    expect(completed?.stats.find((stat) => stat.id === "demand")?.state).toBeNull();
    expect(flow?.staleText).toMatch(/Grid checks every hour/);
  });

  it("falls back to the next linepack publication when the preferred value is null", () => {
    const release = fixtureRelease();
    const cleared = release.components.map((row) =>
      row.publication_id === "PUBOB693" || row.publication_id === "PUBOB30" ? { ...row, value: null } : row,
    );
    const opening = cleared.find((row) => row.publication_id === "PUBOB693");
    if (!opening) {
      throw new Error("opening linepack missing");
    }
    const interim: GasComponent = {
      ...opening,
      publication_id: "PUBOB29",
      metric_id: "gas.gb_nts.linepack.opening_interim",
      name: "Opening linepack, interim",
      value: 320.4,
      applicable_at: "2026-10-13T12:00:00.000Z",
    };
    const predicted: GasComponent = {
      ...opening,
      publication_id: "PUBOB31",
      metric_id: "gas.gb_nts.linepack.pclp2",
      name: "Predicted closing linepack",
      quantity_kind: "stock",
      value: 330,
      applicable_at: "2026-10-13T18:00:00.000Z",
      forecast_issued_at: null,
    };
    const document = buildGasDocument([{ ...release, components: [...cleared, interim, predicted] }], NOW, null);
    if (!document.available) {
      throw new Error("fixture release missing");
    }
    const linepack = document.slices[0]?.linepack;
    expect(linepack?.opening).toBe("320.4");
    expect(linepack?.predictedClose).toBe("330.0");
  });

  it("does not rescale an incomplete component set to 100", () => {
    const release = fixtureRelease();
    const document = buildGasDocument(
      [{ ...release, components: release.components.filter((row) => row.publication_id !== "PUBOBJ1018") }],
      NOW,
      null,
    );
    if (!document.available) {
      throw new Error("fixture release missing");
    }
    const completed = document.slices.find((slice) => slice.basis === "completed");
    const flow = document.slices.find((slice) => slice.basis === "flow");
    expect(completed?.demand).toEqual([]);
    expect(flow?.entry.reduce((total, row) => total + row.percent, 0)).toBe(100);
  });

  it("names an entry by its terminal and keeps production countries out of the page", () => {
    expect(entryAtTerminal("Easington")).toBe("Entry at Easington");
    const document = buildGasDocument([fixtureRelease()], NOW, null);
    expect(bannedGasPhrases(JSON.stringify(document))).toEqual([]);
    expect(GAS_SYSTEM_STANDFIRST).toContain("Updated hourly");
  });

  it("fills demand, linepack and storage on a within-day flow and keeps the day partial", () => {
    const release = fixtureRelease();
    const at = "2026-10-22T06:46:00.000Z";
    const published = "2026-10-22T06:47:00.000Z";
    const sample = (role: GasInstantaneousSample["role"], name: string, value: number, unit: GasInstantaneousSample["unit"]): GasInstantaneousSample => ({
      role,
      name,
      unit,
      value,
      applicable_at: at,
      published_at: published,
    });
    const today: GasRelease = {
      ...release,
      gas_day: gasDayFromLabel("2026-10-22"),
      instantaneous: [
        sample("demand", "NTS Demand Flow", 197.40028, "mscm/d"),
        sample("demand_part", "Industrial Demand Flow", 2.06666, "mscm/d"),
        sample("demand_part", "Interconnector Export Demand Flow", 39.08287, "mscm/d"),
        sample("demand_part", "LDZ Offtake Flow", 134.11892, "mscm/d"),
        sample("demand_part", "Power Station Demand Flow", 20.28498, "mscm/d"),
        sample("demand_part", "Storage Demand Flow", 1.123, "mscm/d"),
        sample("linepack", "NTS Actual Linepack", 343.21306, "mscm"),
        sample("storage_withdrawal", "ALDBROUGH", 15.54475, "mscm/d"),
        sample("storage_withdrawal", "EASINGTON ROUGH ST", 3.16863, "mscm/d"),
        sample("storage_withdrawal", "HILLTOP", 0, "mscm/d"),
        sample("storage_withdrawal", "HOLE HOUSE FARM", 0, "mscm/d"),
        sample("storage_withdrawal", "HOLFORD", 0, "mscm/d"),
        sample("storage_withdrawal", "HORNSEA", 0, "mscm/d"),
        sample("storage_withdrawal", "STUBLACH", 19.34065, "mscm/d"),
      ],
    };
    const now = new Date("2026-10-22T06:47:00.000Z");
    const document = buildGasDocument([today], now, null);
    if (!document.available) {
      throw new Error("within-day release missing");
    }
    expect(document.defaultDay).toBe("2026-10-22");
    expect(document.defaultBasis).toBe("flow");
    const flow = document.slices.find((slice) => slice.day === "2026-10-22" && slice.basis === "flow");
    expect(flow?.state).toBe("partial");
    expect(flow?.stats.map((stat) => stat.valueLabel)).not.toContain("—");
    expect(flow?.stats.map((stat) => stat.state)).not.toContain("not_yet_available");
    expect(flow?.stats.find((stat) => stat.id === "demand")).toMatchObject({
      valueLabel: "197.4",
      unit: "million m³/day",
      asOfLabel: null,
      state: "partial",
    });
    expect(flow?.stats.find((stat) => stat.id === "linepack")?.valueLabel).toBe("343.2");
    expect(flow?.stats.find((stat) => stat.id === "storage")).toMatchObject({
      valueLabel: "36.9",
      unit: "million m³/day",
      state: "partial",
    });
    expect(flow?.linepack.current).toBe("343.2");
    expect(flow?.linepack.currentAsOf).toBeNull();
    expect(flow?.storage.injection).toBe("1.1");
    expect(flow?.storage.withdrawal).toBe("38.1");
    expect(flow?.demand.reduce((total, row) => total + row.percent, 0)).toBe(100);
    expect(flow?.demand.map((row) => row.valueLabel)).toEqual(["2.1", "39.1", "134.1", "20.3", "1.1"]);
    expect(flow?.series.some((point) => point.demand === 197.40028)).toBe(true);
    const partSum = [2.06666, 39.08287, 134.11892, 20.28498, 1.123].reduce((total, value) => total + value, 0);
    expect(partSum).not.toBe(197.40028);
  });

  it("labels a borrowed completed figure with its gas day and defaults a thin day away", () => {
    const release = fixtureRelease();
    const thin: GasRelease = {
      ...release,
      gas_day: gasDayFromLabel("2026-10-21"),
      bases: ["flow"],
      components: release.components.filter((row) => row.basis === "flow"),
      instantaneous: [],
    };
    const now = new Date("2026-10-22T06:47:00.000Z");
    const document = buildGasDocument([thin, release], now, null);
    if (!document.available) {
      throw new Error("thin release missing");
    }
    expect(document.days.map((day) => day.label)).toEqual(["2026-10-21", "2026-10-13"]);
    expect(document.defaultDay).toBe("2026-10-13");
    expect(document.defaultBasis).toBe("completed");
    const flow = document.slices.find((slice) => slice.day === "2026-10-21" && slice.basis === "flow");
    const dated = formatLondonDayMonthYear("2026-10-13");
    expect(flow?.stats.find((stat) => stat.id === "demand")).toMatchObject({
      asOfLabel: dated,
      valueLabel: expect.not.stringMatching(/^—$/),
    });
    expect(flow?.stats.every((stat) => stat.valueLabel !== "—")).toBe(true);
    expect(flow?.linepack.opening).not.toBe("—");
    expect(flow?.linepack.openingAsOf).toBe(dated);
    expect(flow?.storage.injection).not.toBe("—");
    expect(flow?.storage.injectionAsOf).toBe(dated);
    expect(flow?.storage.withdrawalAsOf).toBe(dated);
    expect(flow?.demandAsOfLabel).toBe(dated);
    expect(flow?.demand.length).toBeGreaterThan(0);
    expect(flow?.demand.every((row) => row.unit === "million m³")).toBe(true);
  });

  it("does not publish a storage withdrawal that is missing a site", () => {
    const release = fixtureRelease();
    const at = "2026-10-22T06:46:00.000Z";
    const published = "2026-10-22T06:47:00.000Z";
    const sample = (name: string, value: number): GasInstantaneousSample => ({
      role: "storage_withdrawal",
      name,
      unit: "mscm/d",
      value,
      applicable_at: at,
      published_at: published,
    });
    const today: GasRelease = {
      ...release,
      gas_day: gasDayFromLabel("2026-10-22"),
      instantaneous: [
        { role: "demand_part", name: "Storage Demand Flow", unit: "mscm/d", value: 1.123, applicable_at: at, published_at: published },
        sample("ALDBROUGH", 15.54475),
        sample("EASINGTON ROUGH ST", 3.16863),
        sample("HILLTOP", 0),
        sample("HOLE HOUSE FARM", 0),
        sample("HOLFORD", 0),
        sample("HORNSEA", 0),
      ],
    };
    const document = buildGasDocument([today], new Date(published), null);
    if (!document.available) {
      throw new Error("within-day release missing");
    }
    const storage = document.slices
      .find((slice) => slice.basis === "flow")
      ?.stats.find((stat) => stat.id === "storage");
    expect(storage?.valueLabel).not.toBe("17.6");
    expect(storage?.unit).toBe("million m³");
  });

  it("borrows the completed demand breakdown when another day also has flow rates", () => {
    const prior = fixtureRelease();
    const at = "2026-10-13T12:00:00.000Z";
    const withFlow: GasRelease = {
      ...prior,
      instantaneous: DEMAND_PART_NAMES.map((name) => ({
        role: "demand_part" as const,
        name,
        unit: "mscm/d" as const,
        value: 10,
        applicable_at: at,
        published_at: at,
      })),
    };
    const thin: GasRelease = {
      ...withFlow,
      gas_day: gasDayFromLabel("2026-10-21"),
      bases: ["flow"],
      components: withFlow.components.filter((row) => row.basis === "flow"),
      instantaneous: [],
    };
    const document = buildGasDocument([thin, withFlow], new Date("2026-10-22T06:47:00.000Z"), null);
    if (!document.available) {
      throw new Error("thin release missing");
    }
    const flow = document.slices.find((slice) => slice.day === "2026-10-21" && slice.basis === "flow");
    expect(flow?.demandAsOfLabel).toBe(formatLondonDayMonthYear("2026-10-13"));
    expect(flow?.demand.length).toBeGreaterThan(0);
    expect(flow?.demand.every((row) => row.unit === "million m³")).toBe(true);
    expect(flow?.demand.some((row) => row.valueLabel === "10.0")).toBe(false);
  });

  it("stamps carried within-day figures with their own publication time", () => {
    const release = fixtureRelease();
    const now = new Date("2026-10-22T06:47:00.000Z");
    const fresh = "2026-10-22T06:40:00.000Z";
    const oldPublished = "2026-10-22T02:00:00.000Z";
    const oldApplicable = "2026-10-22T01:55:00.000Z";
    const today: GasRelease = {
      ...release,
      gas_day: gasDayFromLabel("2026-10-22"),
      components: release.components.map((row) => ({ ...row, published_at: fresh, retrieved_at: fresh })),
      instantaneous: [
        {
          role: "demand",
          name: "NTS Demand Flow",
          unit: "mscm/d",
          value: 197.4,
          applicable_at: oldApplicable,
          published_at: oldPublished,
        },
      ],
    };
    const document = buildGasDocument([today], now, null);
    if (!document.available) {
      throw new Error("within-day release missing");
    }
    const flow = document.slices.find((slice) => slice.day === "2026-10-22" && slice.basis === "flow");
    expect(flow?.staleText).toContain("Latest gas data is from");
    expect(flow?.stamp.publishedAt).toBe(oldPublished);
    expect(flow?.stamp.dataTime).toBe(oldApplicable);
    expect(flow?.stats.find((stat) => stat.id === "demand")?.valueLabel).toBe("197.4");
  });
});
