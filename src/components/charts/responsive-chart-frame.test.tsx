import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResponsiveChartFrame } from "@/components/charts/responsive-chart-frame";

describe("ResponsiveChartFrame", () => {
  it("does not render chart children during SSR", () => {
    const html = renderToStaticMarkup(
      <ResponsiveChartFrame className="h-40" summary="Series values">
        <div data-testid="chart">chart</div>
      </ResponsiveChartFrame>
    );
    expect(html).toContain("h-40");
    expect(html).toContain("Series values");
    expect(html).not.toContain("data-testid");
  });
});
