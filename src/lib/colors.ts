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
  gb_gas_sap: "#2dd4bf",
  eu_ttf: "#a78bfa",
  eu_natural_gas: "#8b5cf6",
  lng_asia: "#eab308",
};

export const COMMODITY_LABELS: Record<string, string> = {
  brent_crude: "Brent Crude ($/bbl)",
  wti_crude: "WTI Crude ($/bbl)",
  henry_hub_gas: "Henry Hub Gas ($/MMBtu)",
  gb_gas_sap: "GB gas SAP (p/therm)",
  eu_ttf: "Dutch TTF (€/MWh)",
  eu_natural_gas: "EU TTF monthly ($/MMBtu)",
  lng_asia: "LNG Asia JKM ($/MMBtu)",
};

export const COMMODITY_DISPLAY_ORDER = [
  "brent_crude",
  "wti_crude",
  "henry_hub_gas",
  "gb_gas_sap",
  "eu_ttf",
  "eu_natural_gas",
  "lng_asia",
] as const;

export function commodityDisplayIndex(commodity: string): number {
  const index = COMMODITY_DISPLAY_ORDER.findIndex((value) => value === commodity);
  return index === -1 ? COMMODITY_DISPLAY_ORDER.length : index;
}

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
  embedded_solar: "Solar (PV Live estimate)",
  embedded_wind: "Embedded Wind",
};

/** Interconnector colors by country */
export const INTERCONNECTOR_COLORS: Record<string, string> = {
  intfr: "#3b82f6",    // France (IFA)
  intirl: "#22c55e",   // Northern Ireland (Moyle)
  intned: "#f97316",   // Netherlands (BritNed)
  intew: "#16a34a",    // Ireland (East-West)
  intnem: "#f59e0b",   // Belgium (Nemo)
  intnsl: "#06b6d4",   // Norway (North Sea Link)
  intelec: "#eab308",  // France (ElecLink)
  intvkl: "#ec4899",   // Denmark (Viking Link)
  intifa2: "#60a5fa",  // France (IFA2)
  intgrnl: "#a3e635",  // Ireland (Greenlink)
};

export const INTERCONNECTOR_LABELS: Record<string, string> = {
  intfr: "France (IFA)",
  intirl: "Northern Ireland (Moyle)",
  intned: "Netherlands (BritNed)",
  intew: "Ireland (East-West)",
  intnem: "Belgium (Nemo)",
  intnsl: "Norway (NSL)",
  intelec: "France (ElecLink)",
  intvkl: "Denmark (Viking Link)",
  intifa2: "France (IFA2)",
  intgrnl: "Ireland (Greenlink)",
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
