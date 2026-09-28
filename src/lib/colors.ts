import { PUBLIC_COMMODITIES } from "@/lib/commodity-series";

/**
 * Site-wide fuel palette. FUEL_COLORS and FUELINST_COLORS share these hexes
 * so every chart, list, and stacked bar uses one colour per fuel.
 */
const GAS = "#e8743b";
const COAL = "#8a8a8a";
const NUCLEAR = "#c47bdb";
const WIND = "#56b4e9";
const EMBEDDED_WIND = "#9ed6f4";
const SOLAR = "#f0e442";
const EMBEDDED_SOLAR = "#f6ed8a";
const HYDRO = "#4a6fe0";
const BIOMASS = "#2fa876";
const IMPORTS = "#c9899a";
const OTHER = "#8b8b96";

/** Fuel type → chart color mapping. Consistent across all charts. */
export const FUEL_COLORS: Record<string, string> = {
  gas: GAS,
  coal: COAL,
  nuclear: NUCLEAR,
  wind: WIND,
  solar: SOLAR,
  hydro: HYDRO,
  biomass: BIOMASS,
  imports: IMPORTS,
  other: OTHER,
  embedded_wind: EMBEDDED_WIND,
  embedded_solar: EMBEDDED_SOLAR,
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
  embedded_wind: "Embedded Wind",
  embedded_solar: "Solar (PV Live estimate)",
};

/** Dark card surface used for AA checks on small labels. */
export const DARK_SURFACE = "#111111";
/** Card titles (`text-xs font-medium`) — gray-1000 on background-200. */
export const CARD_LABEL_COLOR = "#ededed";

/** Non-fuel series. Must not collide with FUEL_COLORS / FUELINST_COLORS. */
export const DEMAND_SERIES_COLOR = "#f4f4f5";
/** Warm sand — not a fuel, not cyan/teal, not solar yellow. */
export const DOMESTIC_GENERATION_SERIES_COLOR = "#d2a36a";
export const IMPORT_GAP_COLOR = "#b4536a";
export const EXPORT_GAP_COLOR = "#7d9a6e";

export const COMMODITY_COLORS: Record<string, string> = {
  brent_crude: "#f97316",
  wti_crude: "#3b82f6",
  henry_hub_gas: "#22c55e",
  eu_natural_gas: "#a855f7",
  lng_asia: "#f59e0b",
  gb_gas_sap: "#2dd4bf",
};

export const COMMODITY_LABELS: Record<string, string> = {
  brent_crude: "Brent crude ($/bbl)",
  wti_crude: "WTI crude ($/bbl)",
  henry_hub_gas: "Henry Hub gas ($/MMBtu)",
  eu_natural_gas: "Natural gas, Europe (World Bank, monthly)",
  lng_asia: "LNG, Japan import price (World Bank, monthly)",
  gb_gas_sap: "GB gas SAP (p/therm)",
};

export const COMMODITY_CARD_LABELS: Record<string, string> = {
  brent_crude: "Brent crude oil",
  wti_crude: "WTI crude oil",
  henry_hub_gas: "Henry Hub gas",
  eu_natural_gas: "EU natural gas",
  lng_asia: "LNG, Japan",
  gb_gas_sap: "GB gas (SAP)",
};

export const COMMODITY_DISPLAY_ORDER = PUBLIC_COMMODITIES;

export function commodityDisplayIndex(commodity: string): number {
  const index = COMMODITY_DISPLAY_ORDER.findIndex((value) => value === commodity);
  return index === -1 ? COMMODITY_DISPLAY_ORDER.length : index;
}

/** FUELINST fuel type colors (5-min resolution) — same hexes as FUEL_COLORS. */
export const FUELINST_COLORS: Record<string, string> = {
  ccgt: GAS,
  coal: COAL,
  nuclear: NUCLEAR,
  wind: WIND,
  solar: SOLAR,
  hydro: HYDRO,
  biomass: BIOMASS,
  ocgt: GAS,
  oil: OTHER,
  ps: HYDRO,
  other: OTHER,
  embedded_solar: EMBEDDED_SOLAR,
  embedded_wind: EMBEDDED_WIND,
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

export function fuelColor(fuel: string): string {
  return FUEL_COLORS[fuel] ?? FUELINST_COLORS[fuel] ?? OTHER;
}

export function fuelLabel(fuel: string): string {
  return FUEL_LABELS[fuel] ?? FUELINST_LABELS[fuel] ?? fuel.toUpperCase();
}

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
      return OTHER;
  }
}

export function hexToRgb(hex: string): readonly [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ] as const;
}

export function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function hexHue(hex: string): number {
  const [redRaw, greenRaw, blueRaw] = hexToRgb(hex);
  const red = redRaw / 255;
  const green = greenRaw / 255;
  const blue = blueRaw / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) {
    return 0;
  }

  let hue = 0;
  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return (hue * 60 + 360) % 360;
}
