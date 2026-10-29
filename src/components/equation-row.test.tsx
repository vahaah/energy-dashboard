import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EquationRow, equationGridTemplate } from "@/components/equation-row";
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

describe("equation columns", () => {
  it("inserts a 2.5rem operator track between terms and drops one pair at four terms", () => {
    const five = equationGridTemplate(5, true);
    const four = equationGridTemplate(4, true);
    expect(five).toBe(
      "minmax(0, 1fr) 2.5rem minmax(0, 1fr) 2.5rem minmax(0, 1fr) 2.5rem minmax(0, 1fr) 2.5rem minmax(0, 1fr)"
    );
    expect(four).toBe(
      "minmax(0, 1fr) 2.5rem minmax(0, 1fr) 2.5rem minmax(0, 1fr) 2.5rem minmax(0, 1fr)"
    );
    expect(five.split("2.5rem")).toHaveLength(5);
    expect(four.split("2.5rem")).toHaveLength(4);
    expect(equationGridTemplate(3, false)).toBe("repeat(3, minmax(0, 1fr))");
  });
});

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
    expect(html).toContain("grid-rows-subgrid");
    expect(html).toContain("grid-rows-[auto_auto_auto]");
    expect(html).toContain("repeat(2, minmax(0, 1fr))");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("max-w-[24ch]");
    expect(html).toContain('title="Plant and embedded wind and solar"');
    expect(html).not.toContain("pb-[0.35rem]");
    expect(html).not.toContain("border-l");
    expect(html).not.toContain("pl-6");
    expect(html).toContain("items-baseline");
    expect(html).toContain("border-t border-gray-alpha-400");
    expect(html).toContain("font-semibold text-gray-1000");
    expect(html).toContain("font-light");
    expect(html).toContain("leading-none");
    expect(html).toContain("ml-[0.15em]");
    expect(html).toContain("text-[2.25rem] @min-[1102px]:text-[3rem]");
  });

  it("keeps a non-ITSDO demand source on the figure", () => {
    const html = renderToStaticMarkup(<EquationRow power={power("NESO historic generation mix")} />);

    expect(html).toContain('data-source="NESO historic generation mix"');
    expect(html).toContain(`data-geography="${homepageDemandFigureInputs().geography_id}"`);
    expect(html).toContain(">31.4<");
  });
});
