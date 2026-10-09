import { PUBLIC_COMMODITIES } from "@/lib/commodity-series";

const GAS = "#f97316";
const COAL = "#57534e";
const OIL = "#a8a29e";
const NUCLEAR = "#a855f7";
const BIOMASS = "#16a34a";
const WIND = "#0ea5e9";
const EMBEDDED_WIND = "#7dd3fc";
const SOLAR = "#eab308";
const EMBEDDED_SOLAR = "#fde047";
const HYDRO = "#2563eb";
const IMPORTS = "#64748b";
const PUMPED = "#14b8a6";
const BATTERY = "#5eead4";
const OTHER = "#9ca3af";

export const FUEL_COLORS: Record<string, string> = {
  gas: GAS,
  coal: COAL,
  oil: OIL,
  nuclear: NUCLEAR,
  wind: WIND,
  solar: SOLAR,
  hydro: HYDRO,
  biomass: BIOMASS,
  imports: IMPORTS,
  other: OTHER,
  embedded_wind: EMBEDDED_WIND,
  embedded_solar: EMBEDDED_SOLAR,
  pumped_storage: PUMPED,
  battery: BATTERY,
};

export const FUEL_LABELS: Record<string, string> = {
  gas: "Gas",
  coal: "Coal",
  oil: "Oil",
  nuclear: "Nuclear",
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
  biomass: "Biomass",
  imports: "Imports",
  other: "Other",
  embedded_wind: "Embedded wind",
  embedded_solar: "Solar (PV Live estimate)",
  pumped_storage: "Pumped storage",
  battery: "Battery",
};

export const LIGHT_SURFACE = "#ffffff";
export const DARK_SURFACE = "#0a0a0a";
export const LIGHT_CARD_LABEL = "#171717";
export const DARK_CARD_LABEL = "#ededed";
export const CARD_LABEL_COLOR = DARK_CARD_LABEL;

export const DEMAND_SERIES_COLOR = "#171717";
export const DEMAND_SERIES_COLOR_DARK = "#ededed";
export const DOMESTIC_GENERATION_SERIES_COLOR = "#666666";
export const DOMESTIC_GENERATION_SERIES_COLOR_DARK = "#a1a1a1";
export const IMPORT_GAP_COLOR = "#64748b";
export const EXPORT_GAP_COLOR = "#0a7c3e";

export const GROUP_COLORS: Record<string, string> = {
  fossil: GAS,
  renewables: WIND,
  other: NUCLEAR,
  interconnectors: IMPORTS,
  storage: PUMPED,
};

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

export const COMMODITY_CARD_KEYS = ["brent_crude", "henry_hub_gas", "gb_gas_sap"] as const;

export const COMMODITY_DISPLAY_ORDER = PUBLIC_COMMODITIES;

export function commodityDisplayIndex(commodity: string): number {
  const index = COMMODITY_DISPLAY_ORDER.findIndex((value) => value === commodity);
  return index === -1 ? COMMODITY_DISPLAY_ORDER.length : index;
}

export const FUELINST_COLORS: Record<string, string> = {
  ccgt: GAS,
  coal: COAL,
  nuclear: NUCLEAR,
  wind: WIND,
  solar: SOLAR,
  hydro: HYDRO,
  biomass: BIOMASS,
  ocgt: GAS,
  oil: OIL,
  ps: PUMPED,
  other: OTHER,
  embedded_solar: EMBEDDED_SOLAR,
  embedded_wind: EMBEDDED_WIND,
};

export const FUELINST_LABELS: Record<string, string> = {
  ccgt: "CCGT (gas)",
  coal: "Coal",
  nuclear: "Nuclear",
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
  biomass: "Biomass",
  ocgt: "OCGT (gas)",
  oil: "Oil",
  ps: "Pumped storage",
  other: "Other",
  embedded_solar: "Solar (PV Live estimate)",
  embedded_wind: "Embedded wind",
};

const FUEL_CSS_VARS: Record<string, string> = {
  gas: "var(--chart-gas)",
  coal: "var(--chart-coal)",
  oil: "var(--chart-oil)",
  nuclear: "var(--chart-nuclear)",
  biomass: "var(--chart-biomass)",
  wind: "var(--chart-wind)",
  embedded_wind: "var(--chart-embedded-wind)",
  solar: "var(--chart-solar)",
  embedded_solar: "var(--chart-embedded-solar)",
  hydro: "var(--chart-hydro)",
  imports: "var(--chart-imports)",
  pumped_storage: "var(--chart-pumped)",
  battery: "var(--chart-battery)",
  other: "var(--chart-other)",
  ccgt: "var(--chart-gas)",
  ocgt: "var(--chart-gas)",
  npshyd: "var(--chart-hydro)",
  ps: "var(--chart-pumped)",
};

export function fuelColor(fuel: string): string {
  return FUEL_CSS_VARS[fuel] ?? "var(--chart-other)";
}

export function fuelLabel(fuel: string): string {
  return FUEL_LABELS[fuel] ?? FUELINST_LABELS[fuel] ?? fuel;
}

export const INTERCONNECTOR_COLORS: Record<string, string> = {
  intfr: "#3b82f6",
  intirl: "#22c55e",
  intned: "#f97316",
  intew: "#16a34a",
  intnem: "#f59e0b",
  intnsl: "#06b6d4",
  intelec: "#eab308",
  intvkl: "#ec4899",
  intifa2: "#60a5fa",
  intgrnl: "#a3e635",
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

export const INTERCONNECTOR_COUNTRIES: Record<string, string> = {
  intfr: "France",
  intirl: "Northern Ireland",
  intned: "Netherlands",
  intew: "Ireland",
  intnem: "Belgium",
  intnsl: "Norway",
  intelec: "France",
  intvkl: "Denmark",
  intifa2: "France",
  intgrnl: "Ireland",
};

export function carbonIndexColor(index: string): string {
  switch (index) {
    case "very low":
      return "#0a7c3e";
    case "low":
      return "#16a34a";
    case "moderate":
      return "#d97706";
    case "high":
      return "#e5484d";
    case "very high":
      return "#be123c";
    default:
      return OTHER;
  }
}

export const CARBON_INDEX_BANDS = [
  { index: "very low", max: 39 },
  { index: "low", max: 119 },
  { index: "moderate", max: 199 },
  { index: "high", max: 290 },
  { index: "very high", max: Number.POSITIVE_INFINITY },
] as const;

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
