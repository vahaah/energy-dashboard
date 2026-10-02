import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GenerationNowCard } from "@/components/charts/generation-now-card";
import { GenerationDesk } from "@/components/generation-desk";
import { buildNowBySourceView } from "@/lib/generation-desk-view";
import type { LatestFacts } from "@/lib/facts";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

function indexAfter(source: string, snippet: string): number {
  const index = source.indexOf(snippet);
  expect(index, `missing ${snippet}`).toBeGreaterThanOrEqual(0);
  return index;
}

function generation(
  timestamp: string,
  fuelType: string,
  generationMw: number,
  source = "fuelinst"
): Generation5min {
  return { timestamp, fuel_type: fuelType, generation_mw: generationMw, source };
}

function fact(value: number | null, timestamp: string | null, source: string) {
  return {
    value,
    unit: "MW",
    periodStartUtc: timestamp,
    periodEndUtc: timestamp,
    source,
    definition: "test",
  };
}

function facts(generationRows: Generation5min[]): LatestFacts {
  return {
    empty: false,
    emptyState: null,
    coverageStart: "2025-09-28",
    requestedDate: "2026-09-28",
    isHistorical: false,
    isStale: false,
    stamp: null,
    headerStamp: "Data as of test",
    carbon: { ...fact(80, "2026-09-28T07:00:00.000Z", "Carbon Intensity API"), index: "low" },
    demand: fact(24000, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    price: fact(50, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    generationMw: fact(19298, "2026-09-28T07:00:00.000Z", "Elexon BMRS, NESO, Sheffield Solar PV Live"),
    netImportsMw: fact(396, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    pumpedStorageMw: fact(231, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
    shares: [],
    generationRows,
    mixSnapshot: null,
    referenceTimestamp: "2026-09-28T07:00:00.000Z",
  };
}

function snapshot(timestamp: string, demandMw: number): EnergySnapshot {
  return {
    timestamp,
    carbon_intensity: 80,
    carbon_forecast: 80,
    carbon_index: "low",
    demand_mw: demandMw,
    price_gbp_mwh: 50,
    gen_gas_pct: 30,
    gen_coal_pct: 0,
    gen_nuclear_pct: 15,
    gen_wind_pct: 35,
    gen_solar_pct: 5,
    gen_hydro_pct: 5,
    gen_biomass_pct: 5,
    gen_imports_pct: 5,
    gen_other_pct: 0,
    gen_gas_mw: 6000,
    gen_coal_mw: 0,
    gen_nuclear_mw: 3000,
    gen_wind_mw: 7000,
    gen_solar_mw: 1000,
    gen_hydro_mw: 1000,
    gen_biomass_mw: 1000,
    gen_other_mw: 0,
  };
}

const rows: Generation5min[] = [
  generation("2026-09-28 07:00:00", "ccgt", 7563),
  generation("2026-09-28 07:00:00", "wind", 3746),
  generation("2026-09-28 07:00:00", "nuclear", 4015),
  generation("2026-09-28 07:00:00", "biomass", 2948),
  generation("2026-09-28 07:00:00", "npshyd", 571),
  generation("2026-09-28 07:00:00", "ps", 231),
  generation("2026-09-28 07:00:00", "other", 224),
  generation("2026-09-28 07:00:00", "intfr", 396),
  generation("2026-09-28 04:00:00", "embedded_wind", 917, "neso"),
  generation("2026-09-28 07:00:00", "embedded_solar", 0, "pvlive"),
];

describe("generation desk layout", () => {
  it("leads with the answer row and drops the donut and demand profile", () => {
    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={facts(rows)}
        snapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        headlineSnapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        generation={rows}
        range="24h"
        now={new Date("2026-09-28T07:10:00.000Z")}
        onRangeChange={() => undefined}
      />
    );
    const dashboardSource = readFileSync(resolve(import.meta.dirname, "./dashboard.tsx"), "utf8");
    const deskSource = readFileSync(resolve(import.meta.dirname, "./generation-desk.tsx"), "utf8");
    const pageSource = readFileSync(resolve(import.meta.dirname, "../app/page.tsx"), "utf8");

    expect(html).toContain("data-stat=\"generating\"");
    expect(html).toContain("data-stat=\"demand\"");
    expect(html).toContain("data-stat=\"net_imports\"");
    expect(html).toContain("Generating");
    expect(html).toContain("Demand");
    expect(html).toContain("Net imports");
    expect(html).toContain("Powering Britain now");
    expect(html).toContain("Now, by source");
    expect(html).toContain("Demand and generation, including embedded");
    expect(html).toContain("xl:grid-cols-12");
    expect(html).toContain("xl:col-span-5");
    expect(html).toContain("xl:col-span-7");
    expect(html).toContain("h-11");
    expect(html).toContain("text-xs font-medium text-gray-1000");
    expect(html).toContain("Powering Britain now");
    expect(html).toContain("Demand and generation, including embedded");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Exports (generation above demand)");
    expect(html).toContain("Imports (demand above generation)");
    expect(html).not.toContain("Latest mix");
    expect(html).not.toContain("Demand profile");
    expect(html).not.toContain("Generation desk");
    expect(dashboardSource).toContain("What's powering Britain");
    expect(pageSource).toContain("headlineSnapshots={headlineSnapshots}");
    expect(dashboardSource).toContain("headlineSnapshots={headlineSnapshots}");
    expect(dashboardSource).not.toContain("GenerationMixChart");
    expect(dashboardSource).not.toContain("DemandChart");
    expect(dashboardSource).not.toContain("Demand profile");
    expect(indexAfter(dashboardSource, 'id="section-generation"')).toBeLessThan(
      indexAfter(dashboardSource, "Generation mix over time")
    );
    expect(indexAfter(dashboardSource, "Generation mix over time")).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-price"')
    );
    expect(indexAfter(dashboardSource, 'id="section-price"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-transfers"')
    );
    expect(indexAfter(dashboardSource, 'id="section-transfers"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-commodities"')
    );
    expect(indexAfter(dashboardSource, 'id="section-commodities"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-carbon"')
    );
    expect(indexAfter(dashboardSource, "What's powering Britain")).toBeLessThan(
      indexAfter(dashboardSource, "Carbon pulse")
    );
    expect(indexAfter(dashboardSource, 'label="Domestic generation"')).toBeLessThan(
      indexAfter(dashboardSource, 'label="Current carbon"')
    );
    expect(indexAfter(dashboardSource, 'label="Domestic Supply"')).toBeLessThan(
      indexAfter(dashboardSource, 'label="Carbon Intensity"')
    );
    expect(indexAfter(dashboardSource, 'title: "Demand pressure"')).toBeLessThan(
      indexAfter(dashboardSource, 'title: "Carbon stance"')
    );
    expect(indexAfter(dashboardSource, "leads supply at")).toBeLessThan(
      indexAfter(dashboardSource, "Carbon is ${Math.abs(carbonDelta)} g cleaner")
    );
    expect(deskSource).toContain("h-60");
    expect(deskSource).toContain("headlineSnapshots");
  });

  it("labels a historical day by settlement time instead of now", () => {
    const historical = facts([generation("2026-09-20 22:30:00", "ccgt", 8000)]);
    historical.isHistorical = true;
    historical.requestedDate = "2026-09-20";
    historical.generationMw = {
      ...historical.generationMw,
      value: 8000,
      periodStartUtc: "2026-09-20T22:30:00.000Z",
    };
    historical.referenceTimestamp = "2026-09-20T22:30:00.000Z";

    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={historical}
        snapshots={[snapshot("2026-09-20 00:00:00", 21000)]}
        headlineSnapshots={[snapshot("2026-09-20 22:30:00", 21000)]}
        generation={[]}
        range="1y"
        now={new Date("2026-09-28T12:00:00.000Z")}
        onRangeChange={() => undefined}
      />
    );

    expect(html).toContain("Powering Britain at 23:30 BST on 20 Sep 2026");
    expect(html).toContain("By source · sorted by size · share of supply");
    expect(html).toContain('aria-label="What is Powering Britain at 23:30 BST on 20 Sep 2026?"');
    expect(html).not.toContain("Powering Britain now");
    expect(html).not.toContain("Now, by source");
  });

  it("shows missing sources as an em dash with a no-data note", () => {
    const view = buildNowBySourceView(rows);
    const html = renderToStaticMarkup(<GenerationNowCard view={view} />);

    expect(html).toContain("no data since 05:00 BST");
    expect(html).toContain("no data");
    expect(html).toContain("Total supply");
    expect(html).toContain("19.7");
    expect(html).toContain("h-3");
    expect(html).toContain("rounded-full");
    expect(html).not.toContain("truncate");
  });

  it("notes delayed FUELINST and keeps answer-row periods aligned", () => {
    const delayed = facts([
      generation("2026-09-28 03:00:00", "ccgt", 8000),
      generation("2026-09-28 03:00:00", "wind", 4000),
      generation("2026-09-28 03:00:00", "intfr", 1147),
      generation("2026-09-28 02:30:00", "ccgt", 10000),
      generation("2026-09-28 02:30:00", "wind", 9000),
      generation("2026-09-28 02:30:00", "intfr", -800),
    ]);
    delayed.generationMw = {
      ...delayed.generationMw,
      value: 20215,
      periodStartUtc: "2026-09-28T03:00:00.000Z",
      periodEndUtc: "2026-09-28T03:30:00.000Z",
    };
    delayed.demand = {
      ...delayed.demand,
      value: 21500,
      periodStartUtc: "2026-09-28T02:30:00.000Z",
      periodEndUtc: "2026-09-28T03:00:00.000Z",
    };
    delayed.netImportsMw = {
      ...delayed.netImportsMw,
      value: 1147,
      periodStartUtc: "2026-09-28T03:00:00.000Z",
      periodEndUtc: "2026-09-28T03:30:00.000Z",
    };

    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={delayed}
        snapshots={[]}
        headlineSnapshots={[]}
        generation={[]}
        range="24h"
        now={new Date("2026-09-28T08:00:00.000Z")}
        onRangeChange={() => undefined}
      />
    );

    expect(html).toContain("Data delayed: last Elexon update 04:00 BST");
    expect(html).toContain("Demand for 04:00–04:30 BST is not in yet. Figures are 03:30–04:00 BST.");
    expect(html.match(/03:30–04:00 BST/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain("04:00–04:30 BST</time>");
  });
});
