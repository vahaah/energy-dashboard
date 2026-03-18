/** Fuel type → chart color mapping. Consistent across all charts. */
export const FUEL_COLORS: Record<string, string> = {
  gas: "#f97316",       // orange
  coal: "#6b7280",      // gray
  nuclear: "#a855f7",   // purple
  wind: "#22d3ee",      // cyan
  solar: "#facc15",     // yellow
  hydro: "#3b82f6",     // blue
  biomass: "#22c55e",   // green
  imports: "#ec4899",   // pink
  other: "#94a3b8",     // slate
};

export const FUEL_LABELS: Record<string, string> = {
  gas: "Gas",
  coal: "Coal",
  nuclear: "Nuclear",
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
  biomass: "Biomass",
  imports: "Imports",
  other: "Other",
};

export const COMMODITY_COLORS: Record<string, string> = {
  brent_crude: "#f97316",
  wti_crude: "#3b82f6",
  henry_hub_gas: "#22c55e",
};

export const COMMODITY_LABELS: Record<string, string> = {
  brent_crude: "Brent Crude ($/bbl)",
  wti_crude: "WTI Crude ($/bbl)",
  henry_hub_gas: "Henry Hub Gas ($/MMBtu)",
};

/** Carbon index → color */
export function carbonIndexColor(index: string): string {
  switch (index) {
    case "very low":
      return "#22c55e";
    case "low":
      return "#86efac";
    case "moderate":
      return "#facc15";
    case "high":
      return "#f97316";
    case "very high":
      return "#ef4444";
    default:
      return "#94a3b8";
  }
}
