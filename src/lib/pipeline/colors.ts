import type { MarkerShape } from "@/lib/map/marker";
import type { ProjectTechnology } from "@/lib/projects/technology";

export const STAGE_COLORS = {
  under_construction: "#0d94d2",
  consented: "#14933d",
  in_planning: "#d3a107",
} as const;

export function pipelineMarker(technology: ProjectTechnology): { shape: MarkerShape; color: string } {
  switch (technology) {
    case "solar_pv":
      return { shape: "square", color: "#d3a107" };
    case "onshore_wind":
      return { shape: "diamond", color: "#0d94d2" };
    case "offshore_wind":
      return { shape: "triangle", color: "#0d94d2" };
    case "battery":
      return { shape: "ring", color: "#55d3be" };
    case "pumped_storage":
      return { shape: "triangle-down", color: "#12a696" };
    case "hydro":
      return { shape: "circle", color: "#2159d4" };
    case "nuclear":
      return { shape: "plus", color: "#973dce" };
    case "biomass":
    case "energy_from_waste":
    case "landfill_gas":
    case "anaerobic_digestion":
    case "sewage_gas":
    case "advanced_conversion":
      return { shape: "hexagon", color: "#14933d" };
    case "ccgt":
    case "ocgt":
    case "gas_reciprocating":
    case "chp":
      return { shape: "circle", color: "#e06814" };
    case "oil":
    case "tidal":
    case "wave":
    case "geothermal":
    case "hydrogen":
    case "liquid_air":
    case "compressed_air":
    case "flywheel":
    case "heat_pump":
    case "thermal":
    case "demand":
    case "reactive_compensation":
    case "interconnector":
    case "substation":
    case "unspecified":
      return { shape: "circle", color: "#78716c" };
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}
