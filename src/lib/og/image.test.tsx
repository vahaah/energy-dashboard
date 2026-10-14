import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Generation5min } from "@/lib/types";
import { OgImage } from "@/lib/og/image";
import { buildOgCard, fixtureOgSnapshot } from "@/lib/og/model";

describe("og share bars", () => {
  it("grows overview and carbon bars by the exact share", () => {
    const facts = fixtureOgSnapshot().facts;
    if (!facts) {
      throw new Error("fixture facts missing");
    }
    const row = (fuelType: string, generationMw: number): Generation5min => ({
      timestamp: "2026-10-10 11:00:00",
      fuel_type: fuelType,
      generation_mw: generationMw,
      source: "fuelinst",
    });
    const snapshot = {
      ...fixtureOgSnapshot(),
      facts: {
        ...facts,
        generationRows: [row("wind", 6_000), row("ccgt", 3_960), row("oil", 40)],
      },
    };
    const overview = renderToStaticMarkup(
      <OgImage card={buildOgCard({ kind: "focus", focus: "overview" }, snapshot)} />
    );
    const carbon = renderToStaticMarkup(
      <OgImage card={buildOgCard({ kind: "focus", focus: "carbon" }, snapshot)} />
    );

    expect(overview).toContain("flex-grow:0.4");
    expect(overview).toContain("0%");
    expect(carbon).toContain("flex-grow:0.4");
    expect(carbon).toContain("0%");
    expect(overview).not.toContain("flex-grow:0;");
    expect(carbon).not.toContain("flex-grow:0;");
  });
});
