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
import { gasDayFromLabel } from "@/lib/ingest/national-gas/gas-day";
import { gasReleasePath } from "@/lib/ingest/national-gas/check";
import { gasReleaseSchema, type GasComponent, type GasRelease } from "@/lib/ingest/national-gas/release";
import type { Generation5min } from "@/lib/types";

const NOW = new Date("2026-10-15T06:52:00.000Z");

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
    expect(completed?.stats.map((stat) => stat.unit)).toEqual([
      "million m³/day",
      "million m³/day",
      "million m³",
      "million m³/day",
    ]);
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
    const shown = buildGasDocument([release], NOW, inside);
    if (!shown.available) {
      throw new Error("fixture release missing");
    }
    const bridge = shown.slices.find((slice) => slice.basis === "completed")?.bridge;
    expect(bridge?.offtake.unit).toBe("million m³/day");
    expect(bridge?.generation.unit).toBe("GW");
    expect(bridge?.generation.valueLabel).toBe("6.4");
    expect(bridge?.offtake.at).not.toBe(bridge?.generation.at);
    expect(bridge?.period).toContain("Gas day");
    expect(JSON.stringify(bridge)).not.toMatch(/\befficiency\b|\bratio\b/i);
  });

  it("names an entry by its terminal and keeps production countries out of the page", () => {
    expect(entryAtTerminal("Easington")).toBe("Entry at Easington");
    const document = buildGasDocument([fixtureRelease()], NOW, null);
    expect(bannedGasPhrases(JSON.stringify(document))).toEqual([]);
    expect(GAS_SYSTEM_STANDFIRST).toContain("Updated hourly");
  });
});
