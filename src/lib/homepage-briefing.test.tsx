import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomepageBriefing } from "@/components/homepage-briefing";
import type { LatestFacts } from "@/lib/facts";
import {
  buildHomepageCite,
  historicalHomepageH1,
  homepageCitePlainText,
  HOME_CITE_FALLBACK,
  HOME_H1,
} from "@/lib/homepage-briefing";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

function fact(value: number | null, timestamp: string | null, source: string, unit = "MW") {
  return {
    value,
    unit,
    periodStartUtc: timestamp,
    periodEndUtc: timestamp,
    source,
    definition: "test",
  };
}

function generation(
  timestamp: string,
  fuelType: string,
  generationMw: number,
  source = "fuelinst"
): Generation5min {
  return { timestamp, fuel_type: fuelType, generation_mw: generationMw, source };
}

function snapshot(): EnergySnapshot {
  return {
    timestamp: "2026-10-10 11:00:00",
    carbon_intensity: 148,
    carbon_forecast: 148,
    carbon_index: "moderate",
    demand_mw: 32_400,
    price_gbp_mwh: 67,
    price_mid_gbp_mwh: 45.2,
    gen_gas_pct: 20,
    gen_coal_pct: 0,
    gen_nuclear_pct: 15,
    gen_wind_pct: 50,
    gen_solar_pct: 5,
    gen_hydro_pct: 5,
    gen_biomass_pct: 5,
    gen_imports_pct: 0,
    gen_other_pct: 0,
    gen_gas_mw: 6000,
    gen_coal_mw: 0,
    gen_nuclear_mw: 3000,
    gen_wind_mw: 16_000,
    gen_solar_mw: 1000,
    gen_hydro_mw: 1000,
    gen_biomass_mw: 1000,
    gen_other_mw: 0,
  };
}

function facts(generationRows: Generation5min[]): LatestFacts {
  return {
    empty: false,
    emptyState: null,
    coverageStart: "2025-10-10",
    requestedDate: "2026-10-10",
    isHistorical: false,
    isStale: false,
    stamp: "Data as of test",
    headerStamp: "Data as of test",
    carbon: { ...fact(148, "2026-10-10T11:00:00.000Z", "Carbon Intensity API", "gCO₂/kWh"), index: "moderate" },
    demand: fact(32_400, "2026-10-10T11:00:00.000Z", "Elexon BMRS"),
    price: fact(45.2, "2026-10-10T11:00:00.000Z", "Elexon BMRS", "£/MWh"),
    systemPrice: fact(67, "2026-10-10T11:00:00.000Z", "Elexon BMRS", "£/MWh"),
    generationMw: fact(23_000, "2026-10-10T11:00:00.000Z", "Elexon BMRS"),
    netImportsMw: fact(0, "2026-10-10T11:00:00.000Z", "Elexon BMRS"),
    pumpedStorageMw: fact(0, "2026-10-10T11:00:00.000Z", "Elexon BMRS"),
    shares: [],
    generationRows,
    mixSnapshot: snapshot(),
    referenceTimestamp: "2026-10-10 11:00:00",
  };
}

describe("homepage briefing", () => {
  const rows = [
    generation("2026-10-10 11:00:00", "wind", 16_000),
    generation("2026-10-10 11:00:00", "gas", 4000),
    generation("2026-10-10 11:00:00", "nuclear", 3000),
  ];

  it("builds the plan sentence with time, source and units", () => {
    const cite = buildHomepageCite({ facts: facts(rows), headlineSnapshots: [snapshot()] });
    expect(cite.kind).toBe("numbers");
    if (cite.kind !== "numbers") {
      return;
    }

    expect(cite.topFuel).toBe("Wind");
    expect(cite.topGw).toBe("16.0");
    expect(cite.gasSharePct).toBe("17");
    expect(cite.carbon).toBe("148");
    expect(cite.price).toBe("45.20");
    expect(cite.datetime).toBe("2026-10-10T12:00:00+01:00");

    const text = homepageCitePlainText(cite);
    expect(text).toContain("At 12:00 BST on Sat 10 Oct 2026");
    expect(text).toContain("Wind was Britain's largest source of electricity at 16.0 GW (70%)");
    expect(text).toContain("Gas supplied 17%");
    expect(text).toContain("Sources: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV Live");
    expect(text).toContain("gCO₂/kWh");
    expect(text).toContain("£45.20/MWh");
    expect(text).not.toContain("No data yet");
  });

  it("renders H1, time and at least three GW figures in server HTML", () => {
    const cite = buildHomepageCite({ facts: facts(rows), headlineSnapshots: [snapshot()] });
    const html = renderToStaticMarkup(<HomepageBriefing cite={cite} />);

    expect(html).toContain("<h1");
    expect(html).toContain("What&#x27;s powering Britain&#x27;s electricity today");
    expect(html).toContain(HOME_H1.replaceAll("'", "&#x27;"));
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect((html.match(/GW/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("<time");
    expect(html).toContain('dateTime="2026-10-10T12:00:00+01:00"');
    expect(html).toContain("Sources: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV Live");
    expect(html).not.toContain("/MWh.Sources:");
    expect(html).toContain("/MWh. Sources:");
    expect(html).not.toContain("No data yet");
  });

  it("takes cite shares from the aligned generation frame, not facts.shares", () => {
    const manyRows = [
      ...rows,
      generation("2026-10-10 10:00:00", "wind", 16_000),
      generation("2026-10-10 10:30:00", "wind", 16_000),
    ];
    const latest = facts(manyRows);
    latest.shares = [
      { fuel: "solar", mw: 20_000, sharePct: 80 },
      { fuel: "gas", mw: 3000, sharePct: 12 },
      { fuel: "nuclear", mw: 2000, sharePct: 8 },
    ];
    const cite = buildHomepageCite({ facts: latest, headlineSnapshots: [snapshot()] });
    expect(cite.kind).toBe("numbers");
    if (cite.kind !== "numbers") {
      return;
    }
    expect(cite.topFuel).toBe("Wind");
    expect(cite.topGw).toBe("16.0");
    expect(cite.topSharePct).toBe("70");
  });

  it("uses a date-specific H1 for historical days", () => {
    expect(historicalHomepageH1("2026-03-10")).toBe(
      "What powered Britain's electricity on 10 Mar 2026"
    );
  });

  it("never uses the empty-state line when the payload is missing", () => {
    expect(homepageCitePlainText({ kind: "fallback" })).toBe(HOME_CITE_FALLBACK);
    expect(homepageCitePlainText({ kind: "fallback" })).not.toContain("No data yet");
  });

  it("timestamps the sentence from the aligned generation period, not the newest fact", () => {
    const lagged = facts(rows);
    lagged.referenceTimestamp = "2026-10-10 12:30:00";
    lagged.carbon.periodStartUtc = "2026-10-10T12:30:00.000Z";
    lagged.price.periodStartUtc = "2026-10-10T12:30:00.000Z";

    const cite = buildHomepageCite({ facts: lagged, headlineSnapshots: [] });
    expect(cite.kind).toBe("numbers");
    if (cite.kind !== "numbers") {
      return;
    }

    expect(cite.datetime).toBe("2026-10-10T12:00:00+01:00");
    expect(cite.timeLabel).toBe("12:00 BST");
    expect(cite.datetime).not.toContain("13:30");
  });
});
