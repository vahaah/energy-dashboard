export const TECHNOLOGIES = [
  "solar_pv",
  "onshore_wind",
  "offshore_wind",
  "biomass",
  "energy_from_waste",
  "landfill_gas",
  "anaerobic_digestion",
  "sewage_gas",
  "advanced_conversion",
  "hydro",
  "tidal",
  "wave",
  "geothermal",
  "hydrogen",
  "ccgt",
  "ocgt",
  "steam",
  "oil",
  "nuclear",
  "pumped_storage",
] as const;

export type Technology = (typeof TECHNOLOGIES)[number];

export const FAMILIES = [
  "solar",
  "onshore_wind",
  "offshore_wind",
  "bioenergy",
  "hydro",
  "marine",
  "geothermal",
  "hydrogen",
  "gas",
  "oil",
  "nuclear",
  "pumped_storage",
] as const;

export type Family = (typeof FAMILIES)[number];

export const REPD_SOURCE_ID = "desnz-repd";
export const DUKES_SOURCE_ID = "desnz-dukes";
export const REPD_DATASET_ID = "desnz-repd:repd-quarterly";
export const DUKES_DATASET_ID = "desnz-dukes:dukes-5.11";

const REPD_TECHNOLOGY: Record<string, Technology> = {
  "Solar Photovoltaics": "solar_pv",
  "Wind Onshore": "onshore_wind",
  "Wind Offshore": "offshore_wind",
  "Landfill Gas": "landfill_gas",
  "Anaerobic Digestion": "anaerobic_digestion",
  "Biomass (dedicated)": "biomass",
  "Biomass (co-firing)": "biomass",
  "Small Hydro": "hydro",
  "Large Hydro": "hydro",
  "EfW Incineration": "energy_from_waste",
  "Advanced Conversion Technologies": "advanced_conversion",
  "Sewage Sludge Digestion": "sewage_gas",
  "Tidal Stream": "tidal",
  "Tidal Lagoon": "tidal",
  "Shoreline Wave": "wave",
  "Geothermal": "geothermal",
  "Hot Dry Rocks (HDR)": "geothermal",
  "Hydrogen": "hydrogen",
  "Fuel Cell (Hydrogen)": "hydrogen",
  "Pumped Storage Hydroelectricity": "pumped_storage",
};

/** Storage and heat that are not the operational renewable fleet. */
const REPD_SKIP = new Set([
  "Battery",
  "Liquid Air Energy Storage",
  "Compressed Air Energy Storage",
  "Flywheels",
  "Air Source Heat Pumps",
  "Unknown",
]);

export function familyOf(technology: Technology): Family {
  switch (technology) {
    case "solar_pv":
      return "solar";
    case "onshore_wind":
      return "onshore_wind";
    case "offshore_wind":
      return "offshore_wind";
    case "biomass":
    case "energy_from_waste":
    case "landfill_gas":
    case "anaerobic_digestion":
    case "sewage_gas":
    case "advanced_conversion":
      return "bioenergy";
    case "hydro":
      return "hydro";
    case "tidal":
    case "wave":
      return "marine";
    case "geothermal":
      return "geothermal";
    case "hydrogen":
      return "hydrogen";
    case "ccgt":
    case "ocgt":
    case "steam":
      return "gas";
    case "oil":
      return "oil";
    case "nuclear":
      return "nuclear";
    case "pumped_storage":
      return "pumped_storage";
    default: {
      const neverTechnology: never = technology;
      throw new Error(`unknown technology ${neverTechnology}`);
    }
  }
}

/** Conventional plant and pumped storage take the DUKES MW. Renewables take REPD. */
export function countsSource(family: Family): typeof REPD_SOURCE_ID | typeof DUKES_SOURCE_ID {
  switch (family) {
    case "gas":
    case "oil":
    case "nuclear":
    case "pumped_storage":
      return DUKES_SOURCE_ID;
    case "solar":
    case "onshore_wind":
    case "offshore_wind":
    case "bioenergy":
    case "hydro":
    case "marine":
    case "geothermal":
    case "hydrogen":
      return REPD_SOURCE_ID;
    default: {
      const neverFamily: never = family;
      throw new Error(`unknown family ${neverFamily}`);
    }
  }
}

export function repdTechnology(label: string): Technology | "skip" {
  const trimmed = label.trim();
  if (REPD_SKIP.has(trimmed)) {
    return "skip";
  }
  const technology = REPD_TECHNOLOGY[trimmed];
  if (!technology) {
    throw new Error(`REPD operational technology is not mapped: ${trimmed}`);
  }
  return technology;
}

export function dukesTechnology(technology: string, type: string, fuel: string): Technology {
  if (technology === "Solar") {
    return "solar_pv";
  }
  if (technology === "Wind" && type === "Offshore") {
    return "offshore_wind";
  }
  if (technology === "Wind") {
    return "onshore_wind";
  }
  if (technology === "Hydro") {
    return "hydro";
  }
  if (technology === "Pumped Hydro") {
    return "pumped_storage";
  }
  if (technology === "Nuclear") {
    return "nuclear";
  }
  if (technology === "Bioenergy") {
    if (fuel === "MSW") {
      return "energy_from_waste";
    }
    return "biomass";
  }
  if (technology === "Fossil Fuel") {
    if (fuel === "Diesel/Gas Oil" || fuel === "Oil") {
      return "oil";
    }
    if (fuel === "Coal") {
      throw new Error(`DUKES fossil fuel is not mapped: ${type} / ${fuel}`);
    }
    if (type === "Single cycle") {
      return "ocgt";
    }
    if (type === "Conventional steam") {
      return "steam";
    }
    if (type === "CCGT" || fuel === "Natural Gas" || fuel === "Sour Gas") {
      return "ccgt";
    }
  }
  throw new Error(`DUKES technology is not mapped: ${technology} / ${type} / ${fuel}`);
}
