import { OGL_V3_ATTRIBUTION } from "@/lib/attribution";

export const WHOLE_ENERGY_EDITION_YEAR = 2025;

export const WHOLE_ENERGY_TITLE = `UK energy balance ${WHOLE_ENERGY_EDITION_YEAR}: gas, power, oil and heat | Grid`;
export const WHOLE_ENERGY_DESCRIPTION = `How the UK used energy in ${WHOLE_ENERGY_EDITION_YEAR}: natural gas, electricity, oil, heat and transport in TWh, from DESNZ DUKES 2026 table 1.1. Annual figures, not today's.`;
export const WHOLE_ENERGY_H1 = "How do electricity, gas, oil, heat and transport fit together?";

export function wholeEnergyStandfirst(year: number): string {
  return `Annual figures for ${year} from the official energy balance. These are not today's figures.`;
}

export const WHOLE_ENERGY_FLOW_LABEL = "Whole energy flows";

export function wholeEnergyUnitLabel(year: number): string {
  return `TWh, year ${year}.`;
}

export const WHOLE_ENERGY_SCOPE = `UK, including Northern Ireland. Annual, ${WHOLE_ENERGY_EDITION_YEAR}.`;

export const WHOLE_ENERGY_TRANSFORMATION_NOTE =
  "Gas used for power generation is a transformation input. It is already inside primary supply and is not added again. Final electricity is every source in final consumption, not the output of that gas.";

export const WHOLE_ENERGY_DIFFERENCE_NOTE =
  "Statistical difference is primary supply minus primary demand. It is kept as its own row.";

export const WHOLE_ENERGY_STOCK_NOTE = "Stock change: a fall is positive, a rise is negative.";

export const WHOLE_ENERGY_CONVERSION_NOTE =
  "Thousand tonnes of oil equivalent, gross calorific values, converted at 1 toe = 11,630 kWh, so 1 ktoe = 0.01163 TWh. Shown to 0.1 TWh.";

export const WHOLE_ENERGY_SOURCE =
  "DESNZ Energy flow chart 2025, published 30 July 2026, drawn from DUKES 2026 table 1.1.";

export const WHOLE_ENERGY_TABLE_URL =
  "https://www.gov.uk/government/statistics/energy-chapter-1-digest-of-united-kingdom-energy-statistics-dukes";

export const WHOLE_ENERGY_FLOW_URL = "https://www.gov.uk/government/statistics/energy-flow-chart-2025";

export const WHOLE_ENERGY_ATTRIBUTION = OGL_V3_ATTRIBUTION;

export const WHOLE_ENERGY_SECTORS = ["homes", "transport", "industry"] as const;

export type WholeEnergySectorId = (typeof WHOLE_ENERGY_SECTORS)[number];

export const WHOLE_ENERGY_SECTOR_LABEL: Record<WholeEnergySectorId, string> = {
  homes: "Homes",
  transport: "Transport",
  industry: "Industry",
};

export const WHOLE_ENERGY_SECTOR_NOTE: Record<WholeEnergySectorId, string> = {
  homes: "Homes is the domestic row. Included in Other, so it is not added again.",
  transport: "Transport final consumption.",
  industry: "Industry final consumption.",
};

export const PRIMARY_SUPPLY_BASE = "primary energy supply";
export const FINAL_CONSUMPTION_BASE = "final consumption";

export type ShareBase = typeof PRIMARY_SUPPLY_BASE | typeof FINAL_CONSUMPTION_BASE;

export function shareOf(percent: number, base: ShareBase): string {
  return `${percent}% of ${base}`;
}
