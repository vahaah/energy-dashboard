import { describe, expect, it } from "vitest";
import {
  OG_CARBON_SOURCE,
  OG_COMMODITY_SOURCE,
  OG_EYEBROW_SEPARATOR,
  OG_FOOTER,
  OG_GRID_SOURCES,
  OG_PRICE_SOURCE,
  OG_TODAY_SOURCES,
  buildOgCard,
  fixtureOgSnapshot,
  formatOgDayStamp,
  gridEyebrow,
  normalizeOgShares,
  ogFuelKey,
  ogSampleFilename,
  parseOgVariant,
  realisticOgSnapshot,
  sampleOgVariants,
} from "@/lib/og/model";

describe("og model", () => {
  const snapshot = fixtureOgSnapshot();

  it("parses focus and page variants", () => {
    expect(parseOgVariant({})).toEqual({ kind: "focus", focus: "overview" });
    expect(parseOgVariant({ focus: "price" })).toEqual({ kind: "focus", focus: "price" });
    expect(parseOgVariant({ focus: "bogus" })).toEqual({ kind: "focus", focus: "overview" });
    expect(parseOgVariant({ page: "privacy", focus: "carbon" })).toEqual({
      kind: "page",
      page: "privacy",
    });
  });

  it("builds live headline cards from cached facts only", () => {
    const overview = buildOgCard({ kind: "focus", focus: "overview" }, snapshot);
    expect(overview.cached).toBe(true);
    expect(overview.title).toContain("Wind");
    expect(overview.metrics.some((metric) => metric.label === "Demand")).toBe(true);
    expect(overview.metrics.some((metric) => metric.label === "Carbon")).toBe(true);
    expect(overview.mix[0]?.fuel).toBe("wind");
    expect(overview.metrics.find((metric) => metric.label === "Market")?.hint).toBeUndefined();

    const empty = buildOgCard({ kind: "focus", focus: "overview" }, {
      facts: null,
      records: null,
      prices: null,
    });
    expect(empty.cached).toBe(false);
    expect(empty.stamp).toBe("Cached figures unavailable");
  });

  it("normalises a realistic Redis payload so wind, solar and imports appear and sort", () => {
    const live = realisticOgSnapshot();
    const shares = normalizeOgShares(live.facts?.shares ?? []);
    expect(shares[0]?.fuel).toBe("wind");
    expect(shares.map((share) => share.fuel)).toEqual(
      expect.arrayContaining(["wind", "gas", "imports", "solar", "biomass"])
    );
    expect(shares.find((share) => share.fuel === "wind")?.mw).toBe(13_000);
    expect(shares.find((share) => share.fuel === "imports")?.mw).toBe(6_100);
    expect(shares.find((share) => share.fuel === "solar")?.mw).toBe(1_300);
    expect(shares.reduce((sum, share) => sum + share.sharePct, 0)).toBeCloseTo(100, 5);
    expect(shares.every((share, index) => index === 0 || shares[index - 1]!.sharePct >= share.sharePct)).toBe(
      true
    );

    const overview = buildOgCard({ kind: "focus", focus: "overview" }, live);
    expect(overview.title).toContain("Wind is the largest source");
    expect(overview.title).not.toContain("Biomass is the largest source");
    expect(overview.title).toContain("importing 6.1 GW");
    expect(overview.mix.map((slice) => slice.fuel)).toEqual(shares.map((share) => share.fuel));
    expect(overview.mix.every((slice) => slice.label.length > 0 && slice.label !== slice.fuel)).toBe(true);
    expect(overview.mix.map((slice) => slice.fuel)).toContain("hydro");
    expect(overview.mix.map((slice) => slice.fuel)).toContain("pumped_storage");
    expect(overview.mix.reduce((sum, slice) => sum + slice.sharePct, 0)).toBeCloseTo(100, 5);
    expect(overview.mix.find((slice) => slice.fuel === "gas")?.sharePct).toBeGreaterThan(
      overview.mix.find((slice) => slice.fuel === "biomass")?.sharePct ?? 0
    );

    const generation = buildOgCard({ kind: "focus", focus: "generation" }, live);
    expect(generation.title).toContain("Wind is the largest source");
    expect(generation.mix[0]?.fuel).toBe("wind");

    const carbon = buildOgCard({ kind: "focus", focus: "carbon" }, live);
    expect(carbon.metrics.find((metric) => metric.label === "Largest source")?.value).toBe("Wind");
    expect(carbon.mix[0]?.fuel).toBe("wind");
    expect(carbon.mix.every((slice) => Boolean(slice.label))).toBe(true);
  });

  it("maps Elexon and embedded fuel keys onto display fuels", () => {
    expect(ogFuelKey("WIND")).toBe("wind");
    expect(ogFuelKey("embedded_wind")).toBe("wind");
    expect(ogFuelKey("embedded_solar")).toBe("solar");
    expect(ogFuelKey("ccgt")).toBe("gas");
    expect(ogFuelKey("INTFR")).toBe("imports");
    expect(ogFuelKey("ps")).toBe("pumped_storage");
  });

  it("covers every shareable focus and legal page", () => {
    const names = sampleOgVariants().map(ogSampleFilename);
    expect(names).toEqual([
      "focus-overview.png",
      "focus-generation.png",
      "focus-price.png",
      "focus-transfers.png",
      "focus-commodities.png",
      "focus-records.png",
      "focus-carbon.png",
      "page-records.png",
      "page-privacy.png",
      "page-terms.png",
      "page-data-sources.png",
      "page-today.png",
      "page-price-cap.png",
      "page-methodology.png",
      "page-api.png",
      "page-gas.png",
    ]);

    const price = buildOgCard({ kind: "focus", focus: "price" }, snapshot);
    expect(price.title).toContain("£67/MWh");
    expect(price.source).toBe(OG_PRICE_SOURCE);
    const transfers = buildOgCard({ kind: "focus", focus: "transfers" }, snapshot);
    expect(transfers.title).toContain("Importing");
    expect(transfers.kicker).toBe("Net interconnector flow");
    expect(transfers.kicker).not.toMatch(/ {2}/);
    const commodities = buildOgCard({ kind: "focus", focus: "commodities" }, snapshot);
    expect(commodities.metrics).toHaveLength(3);
    expect(commodities.metrics[0]?.value).toBe("$74.20/bbl");
    expect(commodities.metrics[1]?.value).toBe("$3.12/MMBtu");
    expect(commodities.stamp).toBe("Fri 9 Oct 2026");
    expect(commodities.source).toBe(OG_COMMODITY_SOURCE);
    const records = buildOgCard({ kind: "page", page: "records" }, snapshot);
    expect(records.metrics.some((metric) => metric.label === "Highest wind")).toBe(true);
    expect(records.metrics.find((metric) => metric.label === "Lowest carbon")?.value).toBe(
      "18 gCO₂/kWh"
    );
    const privacy = buildOgCard({ kind: "page", page: "privacy" }, snapshot);
    expect(privacy.title).toBe("Privacy");
  });

  it("attributes Sheffield Solar on pages that use embedded solar", () => {
    const today = buildOgCard({ kind: "page", page: "today" }, snapshot);
    const methodology = buildOgCard({ kind: "page", page: "methodology" }, snapshot);
    const sources = buildOgCard({ kind: "page", page: "data-sources" }, snapshot);
    expect(today.source).toContain("Sheffield Solar PV Live");
    expect(methodology.source).toContain("Sheffield Solar PV Live");
    expect(sources.source).toContain("Sheffield Solar PV Live");
    expect(methodology.source).toContain(OG_GRID_SOURCES);
    expect(sources.stamp).toBeNull();
    expect(methodology.stamp).toBeNull();
  });

  it("peeks live Redis values onto today and gas cards", () => {
    const today = buildOgCard({ kind: "page", page: "today" }, snapshot);
    expect(today.metrics.find((metric) => metric.label === "Demand")?.value).toBe("32.4 GW");
    expect(today.mix[0]?.fuel).toBe("wind");
    expect(today.source).toBe(OG_TODAY_SOURCES);

    const gas = buildOgCard({ kind: "page", page: "gas" }, snapshot);
    expect(gas.metrics.some((metric) => metric.value.includes("p/therm"))).toBe(true);
    expect(gas.metrics.some((metric) => metric.value.endsWith("/MMBtu"))).toBe(true);
    expect(gas.source).toBe(OG_COMMODITY_SOURCE);
    expect(gas.stamp).toBe("Fri 9 Oct 2026");
  });

  it("keeps a consistent Grid eyebrow separator and site footer", () => {
    expect(OG_FOOTER).toBe("grid.vahaah.com");
    expect(gridEyebrow("Carbon")).toBe(`Grid${OG_EYEBROW_SEPARATOR}Carbon`);
    expect(buildOgCard({ kind: "focus", focus: "carbon" }, snapshot).eyebrow).toBe("Grid · Carbon");
    expect(buildOgCard({ kind: "focus", focus: "price" }, snapshot).source).toBe(OG_PRICE_SOURCE);
    expect(buildOgCard({ kind: "focus", focus: "carbon" }, snapshot).source).toBe(OG_CARBON_SOURCE);
    expect(formatOgDayStamp("2026-10-12")).toBe("Mon 12 Oct 2026");
  });
});
