import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GasSeriesTable } from "@/components/gas/gas-board";
import type { GasSeriesPoint } from "@/lib/gas/view";

function point(index: number): GasSeriesPoint {
  return {
    at: `2026-10-23T${String(index).padStart(2, "0")}:00:00Z`,
    label: `Hour ${index}`,
    supply: index,
    demand: null,
    supplyForecast: null,
    demandForecast: null,
  };
}

describe("gas series table", () => {
  it("keeps rows past the preview inside the server HTML", () => {
    const series = Array.from({ length: 30 }, (_, index) => point(index));
    const html = renderToStaticMarkup(
      <GasSeriesTable series={series} showDemand={false} showForecast={false} />,
    );
    expect(html).toContain("Hour 0");
    expect(html).toContain("Hour 29");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html.indexOf("Hour 25")).toBeGreaterThan(html.indexOf("<details"));
  });
});
