import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EquationRow } from "@/components/equation-row";
import type { DisplayedPower } from "@/lib/displayed-demand";
import { homepageDemandFigureInputs } from "@/lib/metrics";

function power(demandSource: string): DisplayedPower {
  return {
    demandMw: 31_400,
    generationMw: 30_000,
    transfersMw: 1_400,
    importsMw: null,
    exportsMw: null,
    storageChargingMw: null,
    transmissionDemandMw: 28_000,
    demandSource,
    generationSource: "Elexon BMRS, NESO, Sheffield Solar PV Live",
    transfersSource: "Elexon BMRS",
    demandDefinition: "GB electricity use in this half-hour.",
    demandStartUtc: "2026-10-14T11:00:00.000Z",
    generationStartUtc: "2026-10-14T11:00:00.000Z",
    transfersStartUtc: "2026-10-14T11:00:00.000Z",
    generationRows: [],
    alignmentNote: null,
    balanceClosed: false,
    showEquals: false,
    publishesBatteryCharging: false,
    terms: [
      {
        id: "generation",
        label: "Generation",
        role: "Plant and embedded wind and solar",
        mw: 30_000,
        operator: null,
        help: "GB generation.",
        source: "Elexon BMRS, NESO, Sheffield Solar PV Live",
        displayGw: "30.0",
      },
      {
        id: "demand",
        label: "Demand",
        role: "Electricity use this half-hour",
        mw: 31_400,
        operator: null,
        help: "GB electricity use in this half-hour.",
        source: demandSource,
        displayGw: "31.4",
      },
    ],
  };
}

describe("homepage demand figure", () => {
  it("takes unit, geography and source from the registry and leaves the megawatts", () => {
    const figure = homepageDemandFigureInputs();
    const html = renderToStaticMarkup(<EquationRow power={power(figure.source)} />);

    expect(html).toContain('data-stat="demand"');
    expect(html).toContain(`data-geography="${figure.geography_id}"`);
    expect(html).toContain(`data-source="${figure.source}"`);
    expect(html).toContain(`data-registry-unit="${figure.unit}"`);
    expect(html).toContain(`>${figure.displayUnit}<`);
    expect(html).toContain(">31.4<");
    expect(html).toContain('data-stat="generation"');
    expect(html).not.toContain('data-stat="generation" data-geography');
  });

  it("keeps a non-ITSDO demand source on the figure", () => {
    const html = renderToStaticMarkup(<EquationRow power={power("NESO historic generation mix")} />);

    expect(html).toContain('data-source="NESO historic generation mix"');
    expect(html).toContain(`data-geography="${homepageDemandFigureInputs().geography_id}"`);
    expect(html).toContain(">31.4<");
  });
});
