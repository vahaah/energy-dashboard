import { measuredCostChart, measuredVolumeChart } from "@/lib/constraints/chart-series";

function measuredChartTypes(): void {
  measuredCostChart({ kind: "measured", unit: "GBP", points: [] });
  measuredVolumeChart({ kind: "measured", unit: "MWh", points: [] });

  // @ts-expect-error forecast series cannot render on a measured chart
  measuredCostChart({ kind: "forecast", unit: "GBP", points: [] });

  // @ts-expect-error £ and MWh never share an axis
  measuredCostChart({ kind: "measured", unit: "MWh", points: [] });

  // @ts-expect-error forecast series cannot render on a measured chart
  measuredVolumeChart({ kind: "forecast", unit: "MWh", points: [] });

  // @ts-expect-error £ and MWh never share an axis
  measuredVolumeChart({ kind: "measured", unit: "GBP", points: [] });
}

void measuredChartTypes;
