import { technologyColor } from "@/lib/assets/labels";
import type { Technology } from "@/lib/catalogue/assets/technologies";

/**
 * Shared station groups for the map and the Today card.
 * Nine groups, each with its own shape, so colour is not the only distinction.
 * Battery sits in storage for when the register starts counting it. The plant
 * register still skips batteries.
 */
export const MAP_SHAPES = [
  "circle",
  "diamond",
  "square",
  "triangle",
  "hexagon",
  "plus",
  "ring",
  "pill",
  "bar",
] as const;

export type MapShape = (typeof MAP_SHAPES)[number];

export type MapTechnologyGroupId =
  | "onshore_wind"
  | "offshore_wind"
  | "solar"
  | "hydro"
  | "bioenergy"
  | "nuclear"
  | "gas"
  | "storage"
  | "other";

export type MapTechnologyGroup = {
  id: MapTechnologyGroupId;
  label: string;
  shape: MapShape;
  /** Existing technology colour. No new palette entries. */
  color: string;
  technologies: readonly string[];
};

export const MAP_TECHNOLOGY_GROUPS: readonly MapTechnologyGroup[] = [
  {
    id: "onshore_wind",
    label: "Onshore wind",
    shape: "circle",
    color: technologyColor("onshore_wind"),
    technologies: ["onshore_wind"],
  },
  {
    id: "offshore_wind",
    label: "Offshore wind",
    shape: "diamond",
    color: technologyColor("offshore_wind"),
    technologies: ["offshore_wind"],
  },
  {
    id: "solar",
    label: "Solar",
    shape: "square",
    color: technologyColor("solar_pv"),
    technologies: ["solar_pv"],
  },
  {
    id: "hydro",
    label: "Hydro",
    shape: "triangle",
    color: technologyColor("hydro"),
    technologies: ["hydro", "tidal", "wave"],
  },
  {
    id: "bioenergy",
    label: "Bioenergy",
    shape: "hexagon",
    color: technologyColor("biomass"),
    technologies: ["biomass", "energy_from_waste", "landfill_gas", "anaerobic_digestion", "sewage_gas", "advanced_conversion"],
  },
  {
    id: "nuclear",
    label: "Nuclear",
    shape: "plus",
    color: technologyColor("nuclear"),
    technologies: ["nuclear"],
  },
  {
    id: "gas",
    label: "Gas",
    shape: "ring",
    color: technologyColor("ccgt"),
    technologies: ["ccgt", "ocgt"],
  },
  {
    id: "storage",
    label: "Storage",
    shape: "pill",
    color: technologyColor("pumped_storage"),
    technologies: ["pumped_storage", "battery"],
  },
  {
    id: "other",
    label: "Other",
    shape: "bar",
    color: technologyColor("oil"),
    technologies: ["steam", "oil", "geothermal", "hydrogen"],
  },
];

export const MAP_SIZE_STEPS = [
  { id: "s", label: "Under 50 MW", minMw: 0, radius: 5 },
  { id: "m", label: "50–199 MW", minMw: 50, radius: 8 },
  { id: "l", label: "200–499 MW", minMw: 200, radius: 11 },
  { id: "xl", label: "500 MW and over", minMw: 500, radius: 14 },
] as const;

export type MapSizeStep = (typeof MAP_SIZE_STEPS)[number];

export function groupForStation(technology: Technology | "battery"): MapTechnologyGroup {
  const group = MAP_TECHNOLOGY_GROUPS.find((item) => item.technologies.includes(technology));
  if (!group) {
    throw new Error(`no map group for ${technology}`);
  }
  return group;
}

export function sizeStepForMw(mw: number | null): MapSizeStep {
  if (mw === null || !Number.isFinite(mw) || mw < 50) {
    return MAP_SIZE_STEPS[0];
  }
  if (mw < 200) {
    return MAP_SIZE_STEPS[1];
  }
  if (mw < 500) {
    return MAP_SIZE_STEPS[2];
  }
  return MAP_SIZE_STEPS[3];
}
