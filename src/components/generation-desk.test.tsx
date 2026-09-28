import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GenerationNowCard } from "@/components/charts/generation-now-card";
import { GenerationDesk } from "@/components/generation-desk";
import { buildNowBySourceView } from "@/lib/generation-desk-view";
import type { LatestFacts } from "@/lib/facts";
import type { Generation5min } from "@/lib/types";

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
        snapshots={[]}
        generation={[]}
        range="24h"
        onRangeChange={() => undefined}
      />
    );
    const dashboardSource = readFileSync(resolve(import.meta.dirname, "./dashboard.tsx"), "utf8");
    const deskSource = readFileSync(resolve(import.meta.dirname, "./generation-desk.tsx"), "utf8");

    expect(html).toContain("data-stat=\"generating\"");
    expect(html).toContain("data-stat=\"demand\"");
    expect(html).toContain("data-stat=\"net_imports\"");
    expect(html).toContain("Generating");
    expect(html).toContain("Demand");
    expect(html).toContain("Net imports");
    expect(html).toContain("Powering Britain now");
    expect(html).toContain("Now, by source");
    expect(html).toContain("Demand and domestic generation");
    expect(html).toContain("xl:grid-cols-12");
    expect(html).toContain("xl:col-span-5");
    expect(html).toContain("xl:col-span-7");
    expect(html).toContain("h-11");
    expect(html).not.toContain("Latest mix");
    expect(html).not.toContain("Demand profile");
    expect(html).not.toContain("Generation desk");
    expect(dashboardSource).toContain("What's powering Britain");
    expect(dashboardSource).not.toContain("GenerationMixChart");
    expect(dashboardSource).not.toContain("DemandChart");
    expect(dashboardSource).not.toContain("Demand profile");
    expect(deskSource).toContain("h-60");
  });

  it("shows missing sources as an em dash with a no-data note", () => {
    const view = buildNowBySourceView(rows, 24000);
    const html = renderToStaticMarkup(<GenerationNowCard view={view} />);

    expect(html).toContain("no data since 05:00 BST");
    expect(html).toContain("no data");
    expect(html).toContain("Domestic total");
    expect(html).toContain("19.3");
    expect(html).toContain("h-3");
    expect(html).toContain("rounded-full");
    expect(html).not.toContain("truncate");
  });
});
