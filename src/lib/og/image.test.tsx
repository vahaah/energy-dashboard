import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EIRGRID_GROUP_ATTRIBUTION, ELEXON_ISD_ATTRIBUTION, NATIONAL_GAS_ATTRIBUTION, NESO_OPEN_DATA_ATTRIBUTION, OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import type { Generation5min } from "@/lib/types";
import { OgImage } from "@/lib/og/image";
import { buildOgCard, fixtureOgSnapshot } from "@/lib/og/model";
import type { OgCacheSnapshot } from "@/lib/og/peek";

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

  it("wraps long asset titles and keeps the 1A cards free of live wording", () => {
    const empty: OgCacheSnapshot = { facts: null, records: null, prices: null };
    const longTitle = `${"Keadby gas-fired power station and adjacent battery".repeat(2)} extension`;
    expect(longTitle.length).toBeGreaterThan(72);
    const asset = renderToStaticMarkup(
      <OgImage
        card={buildOgCard(
          { kind: "asset", title: longTitle, kicker: "Gas", source: NATIONAL_GAS_ATTRIBUTION },
          empty,
        )}
      />,
    );
    const short = renderToStaticMarkup(
      <OgImage
        card={buildOgCard(
          { kind: "asset", title: "Drax", kicker: "Biomass", source: NATIONAL_GAS_ATTRIBUTION },
          empty,
        )}
      />,
    );
    expect(asset).toMatch(/font-size:40px/);
    expect(asset).toMatch(/overflow-wrap:break-word/);
    expect(short).toMatch(/font-size:52px/);
    const pages = (["gas-system", "map", "assets", "storage"] as const).map((page) =>
      renderToStaticMarkup(<OgImage card={buildOgCard({ kind: "page", page }, empty)} />),
    );
    for (const html of [asset, short, ...pages]) {
      expect(html).not.toMatch(/\b(live|real-time|right now)\b/i);
      expect(html).not.toMatch(/\bUK\b/);
    }
  });

  it("keeps the 1B cards free of live wording and stamps the licence sentence", () => {
    const empty: OgCacheSnapshot = { facts: null, records: null, prices: null };
    const pages = (
      ["constraints", "storage", "whole-energy", "projects", "northern-ireland", "tools", "changes", "directory", "identifiers", "pipeline"] as const
    ).map((page) => renderToStaticMarkup(<OgImage card={buildOgCard({ kind: "page", page }, empty)} />));
    for (const html of pages) {
      expect(html).not.toMatch(/\b(live|real-time|right now)\b/i);
      expect(html).not.toMatch(/\bUK\b/);
    }
    const constraints = pages[0] ?? "";
    const northernIreland = pages[4] ?? "";
    const directory = pages[7] ?? "";
    expect(constraints).toContain(NESO_OPEN_DATA_ATTRIBUTION);
    expect(pages[1]).toContain(OGL_V3_ATTRIBUTION);
    expect(pages[2]).toContain("official energy balance");
    expect(pages[2]).toContain("today&#x27;s figures");
    expect(pages[3]).toContain(NESO_OPEN_DATA_ATTRIBUTION);
    expect(northernIreland).toContain(EIRGRID_GROUP_ATTRIBUTION);
    expect(directory).toContain(ELEXON_ISD_ATTRIBUTION);
    expect(pages[8]).toContain(ELEXON_ISD_ATTRIBUTION);
    expect(pages[9]).toContain(OGL_V3_ATTRIBUTION);
  });
});
