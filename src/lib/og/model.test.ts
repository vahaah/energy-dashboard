import { describe, expect, it } from "vitest";
import {
  buildOgCard,
  fixtureOgSnapshot,
  ogSampleFilename,
  parseOgVariant,
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

    const empty = buildOgCard({ kind: "focus", focus: "overview" }, {
      facts: null,
      records: null,
      prices: null,
    });
    expect(empty.cached).toBe(false);
    expect(empty.stamp).toBe("Cached figures unavailable");
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
    const transfers = buildOgCard({ kind: "focus", focus: "transfers" }, snapshot);
    expect(transfers.title).toContain("Importing");
    const commodities = buildOgCard({ kind: "focus", focus: "commodities" }, snapshot);
    expect(commodities.metrics).toHaveLength(3);
    const records = buildOgCard({ kind: "page", page: "records" }, snapshot);
    expect(records.metrics.some((metric) => metric.label === "Highest wind")).toBe(true);
    const privacy = buildOgCard({ kind: "page", page: "privacy" }, snapshot);
    expect(privacy.title).toBe("Privacy");
  });
});
