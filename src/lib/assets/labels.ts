import type { Technology } from "@/lib/catalogue/assets/technologies";
import { DUKES_SOURCE_ID, REPD_SOURCE_ID } from "@/lib/catalogue/assets/technologies";
import type { LayerPrecision } from "@/lib/map/precision";
import type { AssetSourceLabel } from "@/lib/assets/types";

export const MAP_COVERAGE_COPY = "The map shows Great Britain. Each layer lists its own coverage.";

export const MAP_KEYBOARD_COPY = "Arrow keys pan the map. Plus and minus zoom.";

export const ASSET_PRECISION = "published_approximate" satisfies LayerPrecision;

export function technologyLabel(technology: Technology): string {
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
    case "steam":
      return "Steam";
    case "oil":
      return "Oil";
    case "nuclear":
      return "Nuclear";
    case "pumped_storage":
      return "Pumped storage";
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}

export function technologyColor(technology: Technology): string {
  switch (technology) {
    case "solar_pv":
      return "#d3a107";
    case "onshore_wind":
      return "#0d94d2";
    case "offshore_wind":
      return "#075985";
    case "biomass":
      return "#14933d";
    case "energy_from_waste":
      return "#65a30d";
    case "landfill_gas":
      return "#4d7c0f";
    case "anaerobic_digestion":
      return "#0f766e";
    case "sewage_gas":
      return "#0e7490";
    case "advanced_conversion":
      return "#3f6212";
    case "hydro":
      return "#2159d4";
    case "tidal":
      return "#1d4ed8";
    case "wave":
      return "#2563eb";
    case "geothermal":
      return "#b45309";
    case "hydrogen":
      return "#0891b2";
    case "ccgt":
      return "#e06814";
    case "ocgt":
      return "#c2410c";
    case "steam":
      return "#9a3412";
    case "oil":
      return "#78716c";
    case "nuclear":
      return "#973dce";
    case "pumped_storage":
      return "#12a696";
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}

export function sourceLabel(sourceId: typeof REPD_SOURCE_ID | typeof DUKES_SOURCE_ID): AssetSourceLabel {
  switch (sourceId) {
    case REPD_SOURCE_ID:
      return "REPD";
    case DUKES_SOURCE_ID:
      return "DUKES";
    default: {
      const neverSource: never = sourceId;
      return neverSource;
    }
  }
}

export function precisionLabel(precision: LayerPrecision): string {
  switch (precision) {
    case "surveyed":
      return "Surveyed";
    case "published_approximate":
      return "Published, approximate";
    case "geocoded_approximate":
      return "Geocoded, approximate";
    case "schematic":
      return "Schematic";
    default: {
      const neverPrecision: never = precision;
      return neverPrecision;
    }
  }
}

export function formatMw(mw: number | null): string {
  if (mw === null) {
    return "—";
  }
  const text = mw.toFixed(3).replace(/\.?0+$/, "");
  return `${text} MW`;
}

export function assetPageTitle(name: string): string {
  const suffix = " — Grid";
  const room = 60 - [...suffix].length;
  const trimmed = [...name].slice(0, room).join("").trimEnd();
  return `${trimmed}${suffix}`;
}

export function assetPageDescription(row: {
  name: string;
  technology: Technology;
  region: string;
  mw: number | null;
  source: AssetSourceLabel;
}): string {
  const capacity = row.mw === null ? "Capacity is not counted" : formatMw(row.mw);
  const text = `${row.name}, ${technologyLabel(row.technology).toLowerCase()} in ${row.region}. ${capacity} from ${row.source}.`;
  return [...text].slice(0, 155).join("");
}

export function containsLiveWord(text: string): boolean {
  return /\blive\b/i.test(text);
}
