export function mapElexonFuel(psrType: string): string {
  switch (psrType) {
    case "Fossil Gas":
      return "gas";
    case "Fossil Hard coal":
      return "coal";
    case "Fossil Oil":
      return "oil";
    case "Nuclear":
      return "nuclear";
    case "Wind":
    case "Wind Onshore":
    case "Wind Offshore":
      return "wind";
    case "Solar":
      return "solar";
    case "Hydro Run-of-river and poundage":
    case "Hydro Water Reservoir":
      return "hydro";
    case "Hydro Pumped Storage":
      return "pumped";
    case "Battery":
    case "Energy storage":
      return "battery";
    case "Biomass":
      return "biomass";
    case "Other":
      return "other";
    default:
      return "other";
  }
}

export const SNAPSHOT_FUELS = [
  "gas",
  "coal",
  "nuclear",
  "wind",
  "solar",
  "hydro",
  "biomass",
  "other",
] as const;

export const SNAPSHOT_STORAGE_FUELS = ["pumped", "battery"] as const;

export const SNAPSHOT_MIX_FUELS = [
  ...SNAPSHOT_FUELS.filter((fuel) => fuel !== "other"),
  "imports",
  "other",
] as const;
