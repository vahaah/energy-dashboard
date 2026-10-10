import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarbonIntensityTooltip } from "@/components/charts/carbon-intensity-chart";
import { ChartTooltipCard, ChartTooltipRow } from "@/components/charts/chart-tooltip";
import { CommodityNativeTooltip } from "@/components/charts/commodity-chart";
import { DemandBalanceTooltip } from "@/components/charts/demand-balance-chart";
import { GenerationStackTooltip } from "@/components/charts/generation-stack-chart";
import { InterconnectorFlowsTooltip } from "@/components/charts/interconnector-flows-chart";
import { ElectricityPriceTooltip } from "@/components/charts/price-chart";
import { TransitionTooltip } from "@/components/energy-transition";
import { buildCommodityChartSeries, commodityTime } from "@/lib/commodity-chart-model";
import { fuelColor } from "@/lib/colors";
import type { CommodityPrice } from "@/lib/types";

describe("ChartTooltipRow", () => {
  it("keeps the text label and hides a matching colour swatch from the accessibility tree", () => {
    const html = renderToStaticMarkup(
      <ChartTooltipRow color="var(--chart-gas)" label="Gas" value="41.2%" />
    );

    expect(html).toContain("Gas");
    expect(html).toContain("41.2%");
    expect(html).toContain("aria-hidden=\"true\"");
    expect(html).toContain("background-color:var(--chart-gas)");
    expect(html).toContain("rounded-full");
    expect(html).not.toContain("aria-label");
  });
});

describe("ChartTooltipCard", () => {
  it("uses the shared Card surface tokens from the design system", () => {
    const html = renderToStaticMarkup(
      <ChartTooltipCard time="10 Oct 12:00 BST">
        <ChartTooltipRow color="#0ea5e9" label="Wind" value="22.0%" />
      </ChartTooltipCard>
    );

    expect(html).toContain("surface-card");
    expect(html).toContain("text-mono-12");
    expect(html).toContain("10 Oct 12:00 BST");
    expect(html).toContain("Wind");
  });
});

describe("GenerationStackTooltip", () => {
  it("swatches fuels with series colours, not the stacked-area stroke", () => {
    const html = renderToStaticMarkup(
      <GenerationStackTooltip
        active
        range="24h"
        label={Date.UTC(2026, 9, 10, 11, 0)}
        payload={[
          {
            dataKey: "gas",
            name: "Gas",
            value: 41.2,
            color: "var(--background-100)",
          },
          {
            dataKey: "wind",
            name: "Wind",
            value: 22,
            color: "var(--background-100)",
          },
          {
            dataKey: "solar",
            name: "Solar",
            value: 0,
            color: "var(--background-100)",
          },
        ]}
      />
    );

    expect(html).toContain("Gas");
    expect(html).toContain("Wind");
    expect(html).not.toContain(">Solar<");
    expect(html).toContain(`background-color:${fuelColor("gas")}`);
    expect(html).toContain(`background-color:${fuelColor("wind")}`);
    expect(html).not.toContain("background-color:var(--background-100)");
    expect(html).toContain("aria-hidden=\"true\"");
    expect(html).toContain("41.2%");
    expect(html).toContain("22.0%");
  });
});

describe("DemandBalanceTooltip", () => {
  it("adds a colour swatch beside each series label", () => {
    const html = renderToStaticMarkup(
      <DemandBalanceTooltip
        active
        range="24h"
        label="2026-10-10 11:00:00"
        payload={[
          { dataKey: "demandGw", name: "Demand (incl. embedded)", value: 32.4 },
          { dataKey: "generationGw", name: "Generation (incl. embedded)", value: 30.1 },
          { dataKey: "demandForecastGw", name: "Demand forecast (NDF)", value: 31.8 },
        ]}
      />
    );

    expect(html).toContain("Demand (incl. embedded)");
    expect(html).toContain("Generation (incl. embedded)");
    expect(html).toContain("Demand forecast (NDF)");
    expect(html).toContain("background-color:var(--gray-1000)");
    expect(html).toContain("background-color:var(--gray-900)");
    expect(html).toContain("background-color:var(--gray-700)");
    expect(html).toContain("aria-hidden=\"true\"");
  });
});

describe("CarbonIntensityTooltip", () => {
  it("adds a colour swatch beside actual and forecast labels", () => {
    const html = renderToStaticMarkup(
      <CarbonIntensityTooltip
        active
        range="24h"
        label="2026-10-10 11:00:00"
        payload={[
          { dataKey: "actual", name: "Actual", value: 76, color: "var(--gray-1000)" },
          { dataKey: "forecast", name: "Forecast", value: 74, color: "var(--gray-700)" },
        ]}
      />
    );

    expect(html).toContain("Actual");
    expect(html).toContain("Forecast");
    expect(html).toContain("background-color:var(--gray-1000)");
    expect(html).toContain("background-color:var(--gray-700)");
    expect(html).toContain("aria-hidden=\"true\"");
  });
});

describe("ElectricityPriceTooltip", () => {
  it("adds a colour swatch beside the price label", () => {
    const html = renderToStaticMarkup(
      <ElectricityPriceTooltip
        active
        range="24h"
        label="2026-10-10 11:00:00"
        name="Market price"
        payload={[{ value: 64.5 }]}
      />
    );

    expect(html).toContain("Market price");
    expect(html).toContain("£64.50");
    expect(html).toContain("background-color:var(--gray-1000)");
    expect(html).toContain("aria-hidden=\"true\"");
  });
});

describe("InterconnectorFlowsTooltip", () => {
  it("adds a colour swatch beside each interconnector label", () => {
    const html = renderToStaticMarkup(
      <InterconnectorFlowsTooltip
        active
        range="24h"
        label="2026-10-10 11:00:00"
        payload={[
          { dataKey: "intfr", name: "France (IFA)", value: 1.2, color: "#3b82f6" },
          { dataKey: "other", name: "Other", value: -0.4, color: "var(--chart-other)" },
        ]}
      />
    );

    expect(html).toContain("France (IFA)");
    expect(html).toContain("Other");
    expect(html).toContain("background-color:#3b82f6");
    expect(html).toContain("background-color:var(--chart-other)");
    expect(html).toContain("aria-hidden=\"true\"");
  });
});

describe("CommodityNativeTooltip swatches", () => {
  it("hides series colour swatches from the accessibility tree", () => {
    const series = buildCommodityChartSeries(
      [
        {
          date: "2026-03-10",
          commodity: "brent_crude",
          price: 77,
          currency: "USD",
          unit: "$/BBL",
        } satisfies CommodityPrice,
      ],
      ["brent_crude"],
      "native"
    );
    const html = renderToStaticMarkup(
      <CommodityNativeTooltip
        active
        range="1y"
        label={commodityTime("2026-03-10")}
        series={series}
      />
    );

    expect(html).toContain("Brent crude ($/bbl)");
    expect(html).toContain(`background-color:${series[0]?.color}`);
    expect(html).toContain("aria-hidden=\"true\"");
  });
});

describe("TransitionTooltip", () => {
  it("keeps coal and wind labels next to hidden colour swatches", () => {
    const html = renderToStaticMarkup(
      <TransitionTooltip
        active
        label={2015}
        payload={[
          { name: "Coal", value: 22.4, color: "#57534e" },
          { name: "Wind", value: 17.1, color: "#0ea5e9" },
        ]}
      />
    );

    expect(html).toContain("Coal");
    expect(html).toContain("Wind");
    expect(html).toContain("background-color:#57534e");
    expect(html).toContain("background-color:#0ea5e9");
    expect(html).toContain("aria-hidden=\"true\"");
  });
});
