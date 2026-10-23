import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GenerationNowCard } from "@/components/charts/generation-now-card";
import { GenerationDesk } from "@/components/generation-desk";
import { DISPLAYED_DEMAND_STAT } from "@/lib/displayed-demand";
import { emptyLookAhead } from "@/lib/forecast-model";
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
    systemPrice: fact(50, "2026-09-28T07:00:00.000Z", "Elexon BMRS"),
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
  generation("2026-09-28 07:00:00", "embedded_wind", 917, "neso"),
  generation("2026-09-28 07:00:00", "embedded_solar", 0, "pvlive"),
];

describe("generation desk layout", () => {
  it("opens with the equation, mix bar and grouped source table", () => {
    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={facts(rows)}
        snapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        headlineSnapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        generation={rows}
        headlineGeneration={rows}
        range="24h"
        now={new Date("2026-09-28T07:10:00.000Z")}
      />
    );
    const dashboardSource = readFileSync(resolve(import.meta.dirname, "./dashboard.tsx"), "utf8");
    const deskSource = readFileSync(resolve(import.meta.dirname, "./generation-desk.tsx"), "utf8");
    const pageSource = readFileSync(resolve(import.meta.dirname, "../app/page.tsx"), "utf8");
    const payloadSource = readFileSync(
      resolve(import.meta.dirname, "../lib/dashboard-payload.ts"),
      "utf8"
    );

    expect(html).toContain(`data-stat="${DISPLAYED_DEMAND_STAT}"`);
    expect(html).toContain('data-stat="generation"');
    expect(html).toContain('data-stat="imports"');
    expect(html).toContain('data-balanced="true"');
    expect(html).toContain("Demand");
    expect(html).toContain("Generation");
    expect(html).toContain("Imports");
    expect(html).toContain("Share of generation");
    expect(html).toContain("Fossil fuels");
    expect(html).toContain("Wind, solar and hydro");
    expect(html).toContain("Other sources");
    expect(html).toContain("Interconnectors");
    expect(html).toContain("Storage");
    expect(html).toContain("Demand and generation, including embedded");
    expect(html).toContain(">20.6<");
    expect(html).not.toContain(">24.9<");
    expect(html).not.toContain(">24.0<");
    expect(html).not.toContain("Powering Britain now");
    expect(html).not.toContain("Now, by source");
    expect(html).not.toContain("Latest mix");
    expect(html).not.toContain("Demand profile");
    expect(html).not.toContain("Generation desk");
    expect(html).not.toContain("SP ");
    expect(dashboardSource).toContain("What does power cost?");
    expect(dashboardSource).toContain("Where is power flowing?");
    expect(dashboardSource).toContain("How has the mix changed?");
    expect(dashboardSource).toContain("Gas & oil");
    expect(dashboardSource).toContain("How clean is it?");
    expect(dashboardSource).not.toContain("recut as a live briefing");
    expect(dashboardSource).not.toContain("Shareable URL state");
    expect(dashboardSource).not.toContain("Demand pressure");
    expect(dashboardSource).not.toContain("transfer stance");
    expect(dashboardSource).not.toContain("Imbalance price");
    expect(dashboardSource).not.toContain("Carbon pulse");
    expect(dashboardSource).not.toContain("KpiCard");
    expect(pageSource).toContain("export const revalidate = 300");
    expect(pageSource).toContain('export const dynamic = "force-static"');
    expect(pageSource).toContain("HomepageBriefing");
    expect(pageSource).toContain("generateMetadata");
    expect(pageSource).toContain("homepageOgImage");
    expect(pageSource).not.toMatch(/\bsearchParams\b/);
    expect(pageSource).toContain("<Suspense");
    expect(pageSource).not.toContain("/api/dashboard?period=day");
    expect(pageSource).not.toContain("queryPipe");
    expect(payloadSource).toContain("headlineSnapshots");
    expect(payloadSource).toContain("headlineGeneration");
    expect(payloadSource).toContain('"snapshots_range"');
    expect(payloadSource).toContain('"generation_5min_range"');
    expect(payloadSource).not.toContain('"prices_range"');
    expect(payloadSource.match(/queryPipe</g)?.length).toBe(3);
    expect(dashboardSource).toContain("Oil and gas prices are not available for this range.");
    expect(payloadSource).toContain("isNesoPeriod");
    expect(payloadSource).toContain("tinybirdRangeForPeriod");
    expect(payloadSource).toContain("getHistoricPeriodView");
    expect(payloadSource).toContain("getGridRecords");
    expect(payloadSource).toContain("getLookAhead");
    expect(payloadSource).toContain("publicLookAhead");
    expect(payloadSource).not.toContain("queryPipe<LookAhead");
    expect(readFileSync(resolve(import.meta.dirname, "./period-tabs.tsx"), "utf8")).toContain(
      "PERIOD_OPTIONS"
    );
    expect(dashboardSource).toContain("<PeriodTabs");
    expect(readFileSync(resolve(import.meta.dirname, "./site-header.tsx"), "utf8")).not.toContain(
      "PERIOD_OPTIONS"
    );
    expect(readFileSync(resolve(import.meta.dirname, "./site-header.tsx"), "utf8")).not.toContain(
      "Coming in a later update"
    );
    expect(dashboardSource).toContain("headlineSnapshots={headlineSnapshots}");
    expect(dashboardSource).toContain("headlineGeneration={headlineGeneration}");
    expect(dashboardSource).not.toContain("GenerationMixChart");
    expect(dashboardSource).not.toContain("DemandChart");
    expect(indexAfter(dashboardSource, 'id="section-overview"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-generation"')
    );
    expect(indexAfter(dashboardSource, 'id="section-overview"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-price"')
    );
    expect(indexAfter(dashboardSource, 'id="section-price"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-transfers"')
    );
    expect(indexAfter(dashboardSource, 'id="section-transfers"')).toBeLessThan(
      indexAfter(dashboardSource, "How has the mix changed?")
    );
    expect(indexAfter(dashboardSource, "How has the mix changed?")).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-commodities"')
    );
    expect(indexAfter(dashboardSource, 'id="section-commodities"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-records"')
    );
    expect(indexAfter(dashboardSource, 'id="section-records"')).toBeLessThan(
      indexAfter(dashboardSource, 'id="section-carbon"')
    );
    expect(indexAfter(dashboardSource, 'id="section-overview"')).toBeLessThan(
      indexAfter(dashboardSource, "How clean is it?")
    );
    expect(dashboardSource).toContain(
      "carbonLookAhead?.greenest && showsLookAheadCopy(carbonFacts)"
    );
    expect(dashboardSource).not.toContain("new Date(lookAhead.fetchedAt)");
    expect(dashboardSource).toContain('href="/api"');
    expect(deskSource).toContain("LookAheadStrip");
    expect(deskSource).toContain("showsLookAheadCopy(facts)");
    expect(deskSource).toContain("getDisplayedPower");
    expect(deskSource).toContain("buildGroupedSourceTable");
    expect(deskSource).toContain("headlineGeneration");
    expect(readFileSync(resolve(import.meta.dirname, "./share-bar.tsx"), "utf8")).toContain("shareBarSegmentStyle");
    expect(readFileSync(resolve(import.meta.dirname, "./share-bar.tsx"), "utf8")).not.toContain("width:");
    expect(readFileSync(resolve(import.meta.dirname, "./site-header.tsx"), "utf8")).toContain("formatLondonDayMonthYear");
    expect(dashboardSource).toContain("stale={facts.isStale}");
    expect(indexAfter(dashboardSource, "<SiteHeader")).toBeLessThan(
      indexAfter(dashboardSource, "historicalHomepageH1(dayQueryDate)")
    );
    expect(dashboardSource).toContain("historicalHomepageH1");
    expect(dashboardSource).toContain('id="section-overview"');
    expect(dashboardSource).toMatch(/facts\.empty[\s\S]*id="section-overview"/);
    expect(dashboardSource).toContain('from "@/components/ui/card"');
    expect(dashboardSource).toContain("PAGE_STACK_CLASS");
    expect(dashboardSource).toContain('id="section-generation"');
    expect(dashboardSource).toContain("actions={");
    expect(dashboardSource).toContain("headerRight=");
    expect(dashboardSource).not.toContain("gap-12");
    expect(dashboardSource).not.toContain("function EmptyState");
    expect(dashboardSource).not.toContain("surface-card");
    expect(readFileSync(resolve(import.meta.dirname, "./gb-gas-sap-card.tsx"), "utf8")).not.toContain(
      "surface-card"
    );
    expect(readFileSync(resolve(import.meta.dirname, "./section-block.tsx"), "utf8")).toContain(
      "headerRight"
    );
    expect(readFileSync(resolve(import.meta.dirname, "./section-block.tsx"), "utf8")).toContain(
      "<Card"
    );
  });

  it("subtracts exports in the demand equation", () => {
    const exporting = facts([
      ...rows.filter((row) => row.fuel_type !== "intfr"),
      generation("2026-09-28 07:00:00", "intfr", -1800),
    ]);
    exporting.netImportsMw = fact(-1800, "2026-09-28T07:00:00.000Z", "Elexon BMRS");

    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={exporting}
        snapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        headlineSnapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        generation={exporting.generationRows}
        headlineGeneration={exporting.generationRows}
        range="24h"
        now={new Date("2026-09-28T07:10:00.000Z")}
      />
    );

    expect(html).toContain("Exports");
    expect(html).toContain("−");
    expect(html).toContain('data-balanced="true"');
    expect(html).toContain(
      "Generation 20.2 GW, plus Imports 0.0 GW, minus Exports 1.8 GW, equals Demand 18.4 GW."
    );
    expect(html).not.toContain('aria-label="Generation 20.2 GW');
    expect(html).toContain("grid-cols-[minmax(0,1fr)_2.5rem");
    expect(html).not.toContain("grid-cols-3");
    expect(html.match(/What is Exports\?/g)?.length).toBe(2);
    expect(html).toContain(">Imports<");
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
    historical.demand = {
      ...historical.demand,
      value: 21000,
      periodStartUtc: "2026-09-20T22:30:00.000Z",
    };
    historical.referenceTimestamp = "2026-09-20T22:30:00.000Z";

    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={historical}
        snapshots={[snapshot("2026-09-20 00:00:00", 21000)]}
        headlineSnapshots={[snapshot("2026-09-20 22:30:00", 21000)]}
        generation={[]}
        headlineGeneration={[]}
        range="1y"
        now={new Date("2026-09-28T12:00:00.000Z")}
        lookAhead={{
          ...emptyLookAhead(new Date("2026-10-10T12:00:00.000Z")),
          greenest: {
            startUtc: "2026-10-10T13:00Z",
            endUtc: "2026-10-10T15:00Z",
            grams: 43,
            sentence: "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g).",
          },
          wind: {
            tonightGw: 11,
            tomorrowEveningGw: 8.4,
            sparkline: [11, 8.4],
            sentence: "Wind is forecast to fall to 8.4 GW by tomorrow evening.",
            basis: "Transmission-connected wind only. Embedded wind is not in this forecast.",
          },
        }}
      />
    );

    expect(html).toContain("23:30–00:00 BST");
    expect(html).toContain("grid-cols-3");
    expect(html).toContain("Half-hour balance is incomplete.");
    expect(html).not.toContain("Latest settlement period is not in yet");
    expect(html).not.toContain("Powering Britain now");
    expect(html).not.toContain("Now, by source");
    expect(html).not.toContain("SP ");
    expect(html).not.toContain("Look-ahead");
    expect(html).not.toContain("Cleanest time to use power");
    expect(html).not.toContain("Wind is forecast");
  });

  it("hides look-ahead copy on empty dated views", () => {
    const empty = facts([]);
    empty.empty = true;
    empty.emptyState = {
      message: "No data for 1 Jan 2015. Coverage starts 27 Sep 2025.",
      action: "Go to latest",
      href: "/",
    };

    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={empty}
        snapshots={[]}
        headlineSnapshots={[]}
        generation={[]}
        headlineGeneration={[]}
        range="24h"
        lookAhead={{
          ...emptyLookAhead(new Date("2026-10-10T12:00:00.000Z")),
          greenest: {
            startUtc: "2026-10-10T13:00Z",
            endUtc: "2026-10-10T15:00Z",
            grams: 43,
            sentence: "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g).",
          },
          wind: {
            tonightGw: 11,
            tomorrowEveningGw: 8.4,
            sparkline: [11, 8.4],
            sentence: "Wind is forecast to fall to 8.4 GW by tomorrow evening.",
            basis: "Transmission-connected wind only. Embedded wind is not in this forecast.",
          },
        }}
      />
    );

    expect(html).not.toContain("Look-ahead");
    expect(html).not.toContain("Cleanest time to use power");
    expect(html).not.toContain("Wind is forecast");
  });

  it("shows the carbon window and grams on the look-ahead strip", () => {
    const html = renderToStaticMarkup(
      <GenerationDesk
        facts={facts(rows)}
        snapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        headlineSnapshots={[snapshot("2026-09-28 07:00:00", 24000)]}
        generation={rows}
        headlineGeneration={rows}
        range="24h"
        now={new Date("2026-09-28T07:10:00.000Z")}
        lookAhead={{
          ...emptyLookAhead(new Date("2026-10-10T12:00:00.000Z")),
          greenest: {
            startUtc: "2026-10-10T13:00Z",
            endUtc: "2026-10-10T15:00Z",
            grams: 43,
            sentence: "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g).",
          },
        }}
      />
    );

    expect(html).toContain('href="#section-carbon"');
    expect(html).toContain("14:00–16:00 BST (≈43 g).");
  });

  it("shows missing sources as an em dash with a no-data note", () => {
    const staleEmbedded = [
      ...rows.filter((row) => row.fuel_type !== "embedded_wind"),
      generation("2026-09-28 04:00:00", "embedded_wind", 917, "neso"),
    ];
    const view = buildNowBySourceView(staleEmbedded);
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
        headlineGeneration={[]}
        range="24h"
        now={new Date("2026-09-28T08:00:00.000Z")}
      />
    );

    expect(html).toContain("Data delayed: last Elexon update 04:00 BST");
    expect(html).toContain("Latest settlement period is not in yet");
    expect(html).not.toContain("Half-hour balance is incomplete.");
    expect(html).not.toContain("Demand for 04:00–04:30 BST is not in yet");
    expect(html).toContain('data-balanced="true"');
    expect(html).toContain(
      "Generation 19.0 GW, plus Imports 0.0 GW, minus Exports 0.8 GW, equals Demand 18.2 GW."
    );
    expect(html.match(/<time[^>]*>03:30–04:00 BST<\/time>/g)?.length).toBe(1);
    expect(html).not.toContain("04:00–04:30 BST</time>");
  });

  it("keeps the settlement sentence without a stale badge while the period is inside the hourly window", () => {
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
        headlineGeneration={[]}
        range="24h"
        now={new Date("2026-09-28T04:00:00.000Z")}
      />,
    );

    expect(html).toContain("Latest settlement period is not in yet");
    expect(html).not.toContain('data-state="stale"');
    expect(html).not.toContain("Data delayed");
  });
});
