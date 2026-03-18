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
  eu_natural_gas: "#8b5cf6",
  lng_asia: "#eab308",
};

export const COMMODITY_LABELS: Record<string, string> = {
  brent_crude: "Brent Crude ($/bbl)",
  wti_crude: "WTI Crude ($/bbl)",
  henry_hub_gas: "Henry Hub Gas ($/MMBtu)",
  eu_natural_gas: "EU Gas TTF ($/MMBtu)",
  lng_asia: "LNG Asia JKM ($/MMBtu)",
};

/** FUELINST fuel type colors (5-min resolution) */
export const FUELINST_COLORS: Record<string, string> = {
  ccgt: "#f97316",           // orange
  coal: "#6b7280",           // gray
  nuclear: "#a855f7",        // purple
  wind: "#22d3ee",           // cyan
  solar: "#facc15",          // yellow
  hydro: "#3b82f6",          // blue
  biomass: "#22c55e",        // green
  ocgt: "#f43f5e",           // rose
  oil: "#78716c",            // stone
  ps: "#6366f1",             // indigo (pumped storage)
  other: "#94a3b8",          // slate
  embedded_solar: "#fbbf24", // amber-400
  embedded_wind: "#22d3ee",  // cyan
};

export const FUELINST_LABELS: Record<string, string> = {
  ccgt: "CCGT (Gas)",
  coal: "Coal",
  nuclear: "Nuclear",
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
  biomass: "Biomass",
  ocgt: "OCGT (Gas)",
  oil: "Oil",
  ps: "Pumped Storage",
  other: "Other",
  embedded_solar: "Embedded Solar",
  embedded_wind: "Embedded Wind",
};

/** Interconnector colors by country */
export const INTERCONNECTOR_COLORS: Record<string, string> = {
  INTFR: "#3b82f6",   // France — blue
  INTIRL: "#22c55e",   // Ireland — green
  INTNED: "#f97316",   // Netherlands — orange
  INTEW: "#22c55e",    // East-West (Ireland) — green
  INTNEM: "#f59e0b",   // Belgium (Nemo) — amber
  INTNSL: "#06b6d4",   // Norway (North Sea Link) — cyan
  INTELEC: "#f59e0b",  // Belgium (via Eleclink) — amber
  INTVKL: "#ec4899",   // Denmark (Viking Link) — pink
};

export const INTERCONNECTOR_LABELS: Record<string, string> = {
  INTFR: "France (IFA)",
  INTIRL: "Ireland (Moyle)",
  INTNED: "Netherlands (BritNed)",
  INTEW: "Ireland (East-West)",
  INTNEM: "Belgium (Nemo)",
  INTNSL: "Norway (NSL)",
  INTELEC: "Belgium (Eleclink)",
  INTVKL: "Denmark (Viking Link)",
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
