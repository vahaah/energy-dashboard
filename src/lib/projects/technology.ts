export const PROJECT_TECHNOLOGIES = [
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
  "oil",
  "nuclear",
  "pumped_storage",
  "battery",
  "liquid_air",
  "compressed_air",
  "flywheel",
  "heat_pump",
  "chp",
  "gas_reciprocating",
  "thermal",
  "demand",
  "reactive_compensation",
  "interconnector",
  "substation",
  "unspecified",
] as const;

export type ProjectTechnology = (typeof PROJECT_TECHNOLOGIES)[number];

const REPD_TECHNOLOGY: Record<string, ProjectTechnology> = {
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
  Geothermal: "geothermal",
  "Hot Dry Rocks (HDR)": "geothermal",
  Hydrogen: "hydrogen",
  "Fuel Cell (Hydrogen)": "hydrogen",
  "Pumped Storage Hydroelectricity": "pumped_storage",
  Battery: "battery",
  "Liquid Air Energy Storage": "liquid_air",
  "Compressed Air Energy Storage": "compressed_air",
  Flywheels: "flywheel",
  "Air Source Heat Pumps": "heat_pump",
  Unknown: "unspecified",
};

const TEC_TOKEN: Record<string, ProjectTechnology> = {
  "Energy Storage System": "battery",
  "PV Array (Photo Voltaic/solar)": "solar_pv",
  "Wind Onshore": "onshore_wind",
  "Wind Offshore": "offshore_wind",
  "CCGT (Combined Cycle Gas Turbine)": "ccgt",
  "OCGT (Open Cycle Gas Turbine)": "ocgt",
  Hydro: "hydro",
  "Pump Storage": "pumped_storage",
  Nuclear: "nuclear",
  Biomass: "biomass",
  "Gas Reciprocating": "gas_reciprocating",
  Thermal: "thermal",
  Tidal: "tidal",
  "Oil & AGT (Advanced Gas Turbine)": "oil",
  "CHP (Combined Heat and Power)": "chp",
  Hydrogen: "hydrogen",
  Waste: "energy_from_waste",
  "LAES (Liquid Air Energy Storage)": "liquid_air",
  Demand: "demand",
  "Reactive Compensation": "reactive_compensation",
  Interconnector: "interconnector",
  Substation: "substation",
};

const SKIP_PRIMARY = new Set<ProjectTechnology>(["demand", "reactive_compensation", "interconnector", "substation"]);

export function repdProjectTechnology(label: string): ProjectTechnology {
  const technology = REPD_TECHNOLOGY[label.trim()];
  if (!technology) {
    throw new Error(`REPD technology is not mapped: ${label.trim()}`);
  }
  return technology;
}

export function tecProjectTechnology(label: string): ProjectTechnology {
  const tokens = label
    .split(";")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return "unspecified";
  }
  const mapped = tokens.map((token) => {
    const technology = TEC_TOKEN[token];
    if (!technology) {
      throw new Error(`TEC plant type is not mapped: ${token}`);
    }
    return technology;
  });
  return mapped.find((technology) => !SKIP_PRIMARY.has(technology)) ?? mapped[0] ?? "unspecified";
}

export function technologyLabel(technology: ProjectTechnology): string {
  switch (technology) {
    case "solar_pv":
      return "Solar PV";
    case "onshore_wind":
      return "Onshore wind";
    case "offshore_wind":
      return "Offshore wind";
    case "biomass":
      return "Biomass";
    case "energy_from_waste":
      return "Energy from waste";
    case "landfill_gas":
      return "Landfill gas";
    case "anaerobic_digestion":
      return "Anaerobic digestion";
    case "sewage_gas":
      return "Sewage gas";
    case "advanced_conversion":
      return "Advanced conversion";
    case "hydro":
      return "Hydro";
    case "tidal":
      return "Tidal";
    case "wave":
      return "Wave";
    case "geothermal":
      return "Geothermal";
    case "hydrogen":
      return "Hydrogen";
    case "ccgt":
      return "CCGT";
    case "ocgt":
      return "OCGT";
    case "oil":
      return "Oil";
    case "nuclear":
      return "Nuclear";
    case "pumped_storage":
      return "Pumped storage";
    case "battery":
      return "Battery";
    case "liquid_air":
      return "Liquid air";
    case "compressed_air":
      return "Compressed air";
    case "flywheel":
      return "Flywheel";
    case "heat_pump":
      return "Heat pump";
    case "chp":
      return "CHP";
    case "gas_reciprocating":
      return "Gas reciprocating";
    case "thermal":
      return "Thermal";
    case "demand":
      return "Demand";
    case "reactive_compensation":
      return "Reactive compensation";
    case "interconnector":
      return "Interconnector";
    case "substation":
      return "Substation";
    case "unspecified":
      return "Unspecified";
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}
