export const BALANCE_COLUMNS = [
  "coal",
  "manufactured_fuel",
  "primary_oils",
  "petroleum_products",
  "natural_gas",
  "bioenergy_waste",
  "primary_electricity",
  "electricity",
  "heat_sold",
  "total",
] as const;

export type BalanceColumnId = (typeof BALANCE_COLUMNS)[number];

export const FUEL_COLUMNS = [
  "coal",
  "manufactured_fuel",
  "primary_oils",
  "petroleum_products",
  "natural_gas",
  "bioenergy_waste",
  "primary_electricity",
  "electricity",
  "heat_sold",
] as const satisfies readonly BalanceColumnId[];

export type FuelColumnId = (typeof FUEL_COLUMNS)[number];

export const COLUMN_LABEL: Record<BalanceColumnId, string> = {
  coal: "Coal",
  manufactured_fuel: "Manufactured fuel",
  primary_oils: "Primary oils",
  petroleum_products: "Petroleum products",
  natural_gas: "Natural gas",
  bioenergy_waste: "Bioenergy and waste",
  primary_electricity: "Primary electricity",
  electricity: "Electricity",
  heat_sold: "Heat sold",
  total: "Total",
};

const COLUMN_MATCH: Record<string, BalanceColumnId> = {
  coal: "coal",
  "manufactured fuel": "manufactured_fuel",
  "primary oils": "primary_oils",
  "petroleum products": "petroleum_products",
  "natural gas": "natural_gas",
  "bioenergy & waste": "bioenergy_waste",
  "bioenergy and waste": "bioenergy_waste",
  "primary electricity": "primary_electricity",
  electricity: "electricity",
  "heat sold": "heat_sold",
  total: "total",
};

export const ROW_ROLES = [
  "supply_component",
  "primary_supply",
  "statistical_difference",
  "primary_demand",
  "transfers",
  "transformation",
  "transformation_part",
  "energy_industry_use",
  "energy_industry_part",
  "losses",
  "final_consumption",
  "final_part",
  "final_subset",
  "detail",
] as const;

export type RowRole = (typeof ROW_ROLES)[number];

export type RowSpec = {
  id: string;
  match: string;
  label: string;
  role: RowRole;
};

export const ROW_SPEC: readonly RowSpec[] = [
  { id: "production", match: "production", label: "Production", role: "supply_component" },
  { id: "imports", match: "imports", label: "Imports", role: "supply_component" },
  { id: "exports", match: "exports", label: "Exports", role: "supply_component" },
  { id: "marine_bunkers", match: "marine bunkers", label: "Marine bunkers", role: "supply_component" },
  { id: "stock_change", match: "stock change", label: "Stock change", role: "supply_component" },
  { id: "primary_supply", match: "total supply", label: "Primary supply", role: "primary_supply" },
  { id: "statistical_difference", match: "statistical difference", label: "Statistical difference", role: "statistical_difference" },
  { id: "primary_demand", match: "total demand", label: "Primary demand", role: "primary_demand" },
  { id: "transfers", match: "transfers", label: "Transfers", role: "transfers" },
  { id: "transformation", match: "transformation", label: "Transformation", role: "transformation" },
  { id: "electricity_generation", match: "electricity generation", label: "Electricity generation", role: "transformation_part" },
  { id: "major_power_producers", match: "major power producers", label: "Major power producers", role: "detail" },
  { id: "autogenerators", match: "autogenerators", label: "Autogenerators", role: "detail" },
  { id: "heat_generation", match: "heat generation", label: "Heat generation", role: "transformation_part" },
  { id: "petroleum_refineries", match: "petroleum refineries", label: "Petroleum refineries", role: "transformation_part" },
  { id: "coke_manufacture", match: "coke manufacture", label: "Coke manufacture", role: "transformation_part" },
  { id: "blast_furnaces", match: "blast furnaces", label: "Blast furnaces", role: "transformation_part" },
  { id: "patent_fuel_manufacture", match: "patent fuel manufacture", label: "Patent fuel manufacture", role: "transformation_part" },
  { id: "transformation_other", match: "other", label: "Other", role: "transformation_part" },
  { id: "energy_industry_use", match: "energy industry use", label: "Energy industry use", role: "energy_industry_use" },
  { id: "industry_use_electricity", match: "electricity generation", label: "Electricity generation", role: "energy_industry_part" },
  { id: "oil_and_gas_extraction", match: "oil and gas extraction", label: "Oil and gas extraction", role: "energy_industry_part" },
  { id: "industry_use_refineries", match: "petroleum refineries", label: "Petroleum refineries", role: "energy_industry_part" },
  { id: "coal_extraction", match: "coal extraction", label: "Coal extraction", role: "energy_industry_part" },
  { id: "industry_use_coke", match: "coke manufacture", label: "Coke manufacture", role: "energy_industry_part" },
  { id: "industry_use_blast", match: "blast furnaces", label: "Blast furnaces", role: "energy_industry_part" },
  { id: "industry_use_patent", match: "patent fuel manufacture", label: "Patent fuel manufacture", role: "energy_industry_part" },
  { id: "storage", match: "storage", label: "Storage", role: "energy_industry_part" },
  { id: "industry_use_other", match: "other", label: "Other", role: "energy_industry_part" },
  { id: "losses", match: "losses", label: "Losses", role: "losses" },
  { id: "final_consumption", match: "final consumption", label: "Final consumption", role: "final_consumption" },
  { id: "industry", match: "industry", label: "Industry", role: "final_part" },
  { id: "unclassified", match: "unclassified", label: "Unclassified", role: "detail" },
  { id: "iron_and_steel", match: "iron and steel", label: "Iron and steel", role: "detail" },
  { id: "non_ferrous_metals", match: "non-ferrous metals", label: "Non-ferrous metals", role: "detail" },
  { id: "mineral_products", match: "mineral products", label: "Mineral products", role: "detail" },
  { id: "chemicals", match: "chemicals", label: "Chemicals", role: "detail" },
  { id: "mechanical_engineering", match: "mechanical engineering etc", label: "Mechanical engineering", role: "detail" },
  { id: "electrical_engineering", match: "electrical engineering etc", label: "Electrical engineering", role: "detail" },
  { id: "vehicles", match: "vehicles", label: "Vehicles", role: "detail" },
  { id: "food_beverages", match: "food, beverages etc", label: "Food, beverages", role: "detail" },
  { id: "textiles_leather", match: "textiles, leather etc", label: "Textiles, leather", role: "detail" },
  { id: "paper_printing", match: "paper, printing etc", label: "Paper, printing", role: "detail" },
  { id: "other_manufacturing", match: "other manufacturing etc", label: "Other manufacturing", role: "detail" },
  { id: "construction", match: "construction", label: "Construction", role: "detail" },
  { id: "transport", match: "transport", label: "Transport", role: "final_part" },
  { id: "air", match: "air", label: "Air", role: "detail" },
  { id: "rail", match: "rail", label: "Rail", role: "detail" },
  { id: "road", match: "road", label: "Road", role: "detail" },
  { id: "national_navigation", match: "national navigation", label: "National navigation", role: "detail" },
  { id: "pipelines", match: "pipelines", label: "Pipelines", role: "detail" },
  { id: "other_final", match: "other", label: "Other", role: "final_part" },
  { id: "domestic", match: "domestic", label: "Homes", role: "final_subset" },
  { id: "public_administration", match: "public administration", label: "Public administration", role: "detail" },
  { id: "commercial", match: "commercial", label: "Commercial", role: "detail" },
  { id: "agriculture", match: "agriculture", label: "Agriculture", role: "detail" },
  { id: "miscellaneous", match: "miscellaneous", label: "Miscellaneous", role: "detail" },
  { id: "non_energy_use", match: "non energy use", label: "Non-energy use", role: "final_part" },
];

export function normalizeBalanceLabel(value: string): string {
  return value
    .replace(/\[note\s*\d+\]/gi, "")
    .replace(/\(\d+\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function columnIdForHeader(label: string): BalanceColumnId | null {
  return COLUMN_MATCH[normalizeBalanceLabel(label)] ?? null;
}

export function showsInTable(role: RowRole): boolean {
  switch (role) {
    case "supply_component":
    case "primary_supply":
    case "statistical_difference":
    case "primary_demand":
    case "transfers":
    case "transformation":
    case "transformation_part":
    case "energy_industry_use":
    case "losses":
    case "final_consumption":
    case "final_part":
    case "final_subset":
      return true;
    case "energy_industry_part":
    case "detail":
      return false;
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export function sumParent(role: RowRole): "primary_supply" | "transformation" | "final_consumption" | null {
  switch (role) {
    case "supply_component":
      return "primary_supply";
    case "transformation_part":
      return "transformation";
    case "final_part":
      return "final_consumption";
    case "primary_supply":
    case "statistical_difference":
    case "primary_demand":
    case "transfers":
    case "transformation":
    case "energy_industry_use":
    case "energy_industry_part":
    case "losses":
    case "final_consumption":
    case "final_subset":
    case "detail":
      return null;
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export function includedInLabel(role: RowRole): string | null {
  switch (role) {
    case "transformation_part":
      return "Transformation";
    case "final_subset":
      return "Other";
    case "supply_component":
    case "primary_supply":
    case "statistical_difference":
    case "primary_demand":
    case "transfers":
    case "transformation":
    case "energy_industry_use":
    case "energy_industry_part":
    case "losses":
    case "final_consumption":
    case "final_part":
    case "detail":
      return null;
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export function rowDepth(role: RowRole): 0 | 1 {
  switch (role) {
    case "transformation_part":
    case "final_part":
    case "final_subset":
      return 1;
    case "supply_component":
    case "primary_supply":
    case "statistical_difference":
    case "primary_demand":
    case "transfers":
    case "transformation":
    case "energy_industry_use":
    case "energy_industry_part":
    case "losses":
    case "final_consumption":
    case "detail":
      return 0;
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

export function rowEmphasis(role: RowRole): boolean {
  switch (role) {
    case "primary_supply":
    case "statistical_difference":
    case "primary_demand":
    case "transformation":
    case "final_consumption":
      return true;
    case "supply_component":
    case "transfers":
    case "transformation_part":
    case "energy_industry_use":
    case "energy_industry_part":
    case "losses":
    case "final_part":
    case "final_subset":
    case "detail":
      return false;
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}
