import { TECHNOLOGIES, type Technology } from "@/lib/catalogue/assets/technologies";
import { formatDisplay, largestRemainder, roundDisplay } from "@/lib/display-rounding";
import type { MarkerShape } from "@/lib/map/marker";

export const GB_NATIONS = ["England", "Scotland", "Wales"] as const;

export type GbNation = (typeof GB_NATIONS)[number];

export const PIPELINE_STAGES = ["under_construction", "consented", "in_planning"] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number];

export const GW_QUANTUM = 0.1;

/** Links and other non-generation rows. They are not part of the built fleet. */
const NON_GENERATION = new Set(["interconnector", "gas_terminal"]);

const TEC_SOURCE = "neso-open-data";

export type TodayGroupId =
  | "gas"
  | "offshore_wind"
  | "onshore_wind"
  | "solar"
  | "bioenergy"
  | "nuclear"
  | "battery"
  | "pumped_storage"
  | "hydro"
  | "oil_and_other";

export type TodayGroup = {
  id: TodayGroupId;
  label: string;
  shape: MarkerShape;
  /** Existing chart or technology colour. Wind types share one colour. */
  color: string;
};

export const TODAY_GROUPS: readonly TodayGroup[] = [
  { id: "gas", label: "Gas", shape: "circle", color: "#e06814" },
  { id: "offshore_wind", label: "Offshore wind", shape: "triangle", color: "#0d94d2" },
  { id: "onshore_wind", label: "Onshore wind", shape: "diamond", color: "#0d94d2" },
  { id: "solar", label: "Solar", shape: "square", color: "#d3a107" },
  { id: "bioenergy", label: "Bioenergy and waste", shape: "hexagon", color: "#14933d" },
  { id: "nuclear", label: "Nuclear", shape: "plus", color: "#973dce" },
  { id: "battery", label: "Battery storage", shape: "ring", color: "#55d3be" },
  { id: "pumped_storage", label: "Pumped storage", shape: "triangle-down", color: "#12a696" },
  { id: "hydro", label: "Hydro", shape: "circle", color: "#2159d4" },
  { id: "oil_and_other", label: "Oil and other", shape: "square", color: "#78716c" },
];

const GROUP_BY_ID = new Map(TODAY_GROUPS.map((group) => [group.id, group]));

export function todayGroup(id: string): TodayGroup | null {
  return GROUP_BY_ID.get(id as TodayGroupId) ?? null;
}

export function isGbNation(value: string | null): value is GbNation {
  return value !== null && (GB_NATIONS as readonly string[]).includes(value);
}

export function groupOfTechnology(technology: Technology): TodayGroupId {
  switch (technology) {
    case "ccgt":
    case "ocgt":
      return "gas";
    case "offshore_wind":
      return "offshore_wind";
    case "onshore_wind":
      return "onshore_wind";
    case "solar_pv":
      return "solar";
    case "biomass":
    case "energy_from_waste":
    case "landfill_gas":
    case "anaerobic_digestion":
    case "sewage_gas":
    case "advanced_conversion":
      return "bioenergy";
    case "nuclear":
      return "nuclear";
    case "pumped_storage":
      return "pumped_storage";
    case "hydro":
      return "hydro";
    case "steam":
    case "oil":
    case "tidal":
    case "wave":
    case "geothermal":
    case "hydrogen":
      return "oil_and_other";
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}

export type TodayPlant = {
  technology: string;
  country: string | null;
  mw: number | null;
};

export type TodayProject = {
  technology: string;
  country: string | null;
  displayStage: string;
  operationalStatus: string;
  powerMw: number | null;
  sources: readonly string[];
};

export type TodayCount = {
  id: string;
  gw: string | null;
  sites: number;
};

export type TodayFigures = {
  availability: "ready" | "unavailable";
  operating: { gw: string | null; sites: number | null };
  technologies: TodayCount[];
  nations: TodayCount[];
  pipeline: {
    gw: string | null;
    sites: number | null;
    filtered: boolean;
    stages: TodayCount[];
  };
  largestLabels: string[];
};

type Bucket = { exactGw: number; sites: number; publishedMw: boolean };

export function isGbOperatingPlant(plant: TodayPlant): boolean {
  return isGbNation(plant.country) && !NON_GENERATION.has(plant.technology) && isPlantTechnology(plant.technology);
}

function isPlantTechnology(value: string): value is Technology {
  return (TECHNOLOGIES as readonly string[]).includes(value);
}

function isPipelineStage(value: string): value is PipelineStageId {
  return (PIPELINE_STAGES as readonly string[]).includes(value);
}

function isTecOnly(project: TodayProject): boolean {
  return project.country === null && project.sources.length > 0 && project.sources.every((source) => source === TEC_SOURCE);
}

/**
 * A pipeline row counts when it is in England, Scotland or Wales, or when it
 * comes only from the NESO TEC register. That register covers Great Britain
 * and does not publish a country, so those rows stay in the total and out of
 * the nation split.
 */
export function pipelineClass(project: TodayProject): "gb" | "tec" | "out" {
  if (!isPipelineStage(project.displayStage)) {
    return "out";
  }
  if (isGbNation(project.country)) {
    return "gb";
  }
  if (isTecOnly(project)) {
    return "tec";
  }
  return "out";
}

function emptyBucket(): Bucket {
  return { exactGw: 0, sites: 0, publishedMw: false };
}

function addMw(bucket: Bucket, mw: number | null): void {
  bucket.sites += 1;
  if (mw === null || !Number.isFinite(mw) || mw < 0) {
    return;
  }
  bucket.exactGw += mw / 1000;
  bucket.publishedMw = true;
}

function displayParts(buckets: readonly { id: string; bucket: Bucket }[]): TodayCount[] {
  const numeric = buckets.filter((row) => row.bucket.publishedMw);
  const shown = largestRemainder(
    numeric.map((row) => row.bucket.exactGw),
    GW_QUANTUM,
  );
  const labels = new Map(numeric.map((row, index) => [row.id, formatDisplay(shown[index] ?? 0, GW_QUANTUM)]));
  return buckets.map((row) => {
    const label = labels.get(row.id);
    const rounded = label === undefined ? null : Number(label);
    return {
      id: row.id,
      gw: rounded === null || rounded === 0 ? null : label ?? null,
      sites: row.bucket.sites,
    };
  });
}

export function buildTodayFigures(plants: readonly TodayPlant[], projects: readonly TodayProject[]): TodayFigures {
  const operatingPlants = plants.filter(isGbOperatingPlant);
  const batteries = projects.filter(
    (project) => project.technology === "battery" && project.operationalStatus === "operational" && isGbNation(project.country),
  );

  const byGroup = new Map<TodayGroupId, Bucket>();
  for (const group of TODAY_GROUPS) {
    byGroup.set(group.id, emptyBucket());
  }
  const byNation = new Map<GbNation, Bucket>(GB_NATIONS.map((nation) => [nation, emptyBucket()]));

  for (const plant of operatingPlants) {
    if (!isPlantTechnology(plant.technology) || !isGbNation(plant.country)) {
      continue;
    }
    const group = byGroup.get(groupOfTechnology(plant.technology));
    const nation = byNation.get(plant.country);
    if (!group || !nation) {
      continue;
    }
    addMw(group, plant.mw);
    addMw(nation, plant.mw);
  }
  for (const battery of batteries) {
    const group = byGroup.get("battery");
    const nation = isGbNation(battery.country) ? byNation.get(battery.country) : undefined;
    if (!group || !nation) {
      continue;
    }
    addMw(group, battery.powerMw);
    addMw(nation, battery.powerMw);
  }

  const groupRows = TODAY_GROUPS.map((group) => ({ id: group.id, bucket: byGroup.get(group.id) ?? emptyBucket() })).filter(
    (row) => row.bucket.sites > 0,
  );
  const nationRows = GB_NATIONS.map((nation) => ({ id: nation, bucket: byNation.get(nation) ?? emptyBucket() })).filter(
    (row) => row.bucket.sites > 0,
  );
  const technologies = displayParts(groupRows);
  const nations = displayParts(nationRows);

  const operatingExact = groupRows.reduce((sum, row) => sum + row.bucket.exactGw, 0);
  const operatingSites = groupRows.reduce((sum, row) => sum + row.bucket.sites, 0);
  const operatingPublished = groupRows.some((row) => row.bucket.publishedMw);

  const staged = projects.filter((project) => isPipelineStage(project.displayStage));
  const derivable = staged.some((project) => pipelineClass(project) !== "out");
  const included = derivable ? staged.filter((project) => pipelineClass(project) !== "out") : staged;
  const filtered = derivable || staged.length === 0;
  const byStage = new Map<PipelineStageId, Bucket>(PIPELINE_STAGES.map((stage) => [stage, emptyBucket()]));
  for (const project of included) {
    if (!isPipelineStage(project.displayStage)) {
      continue;
    }
    const bucket = byStage.get(project.displayStage);
    if (!bucket) {
      continue;
    }
    addMw(bucket, project.powerMw);
  }
  const stageRows = PIPELINE_STAGES.map((stage) => ({ id: stage, bucket: byStage.get(stage) ?? emptyBucket() })).filter(
    (row) => row.bucket.sites > 0,
  );
  const stages = displayParts(stageRows);
  const pipelineExact = stageRows.reduce((sum, row) => sum + row.bucket.exactGw, 0);
  const pipelineSites = stageRows.reduce((sum, row) => sum + row.bucket.sites, 0);
  const pipelinePublished = stageRows.some((row) => row.bucket.publishedMw);

  const ranked = groupRows
    .slice()
    .sort((left, right) => right.bucket.exactGw - left.bucket.exactGw || left.id.localeCompare(right.id));

  return {
    availability: operatingSites > 0 ? "ready" : "unavailable",
    operating: {
      gw: operatingPublished ? formatDisplay(roundDisplay(operatingExact, GW_QUANTUM), GW_QUANTUM) : null,
      sites: operatingSites > 0 ? operatingSites : null,
    },
    technologies,
    nations,
    pipeline: {
      gw: pipelinePublished ? formatDisplay(roundDisplay(pipelineExact, GW_QUANTUM), GW_QUANTUM) : null,
      sites: pipelineSites > 0 ? pipelineSites : null,
      filtered,
      stages,
    },
    largestLabels: ranked.slice(0, 3).map((row) => todayGroup(row.id)?.label ?? row.id),
  };
}

export function sumDisplayedGw(values: readonly (string | null)[]): number {
  return values.reduce((sum, value) => sum + (value === null ? 0 : Number(value)), 0);
}
