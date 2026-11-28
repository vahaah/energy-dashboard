import { formatEnergy } from "@/lib/format/quantity";
import { displayProjectName } from "@/lib/projects/copy";
import type { EnergyProject } from "@/lib/projects/schema";
import { displayStageLabel, type DisplayStage } from "@/lib/projects/status";
import { type ProjectTechnology } from "@/lib/projects/technology";
import { DESCRIPTION_MAX_CHARS, pageDescriptionLength, pageTitleLength } from "@/lib/site";

const SUFFIX = " | Grid";

/**
 * Site titles aim for 60 characters. The place-bearing pattern
 * "Armshead Farm battery storage, Staffordshire: consented | Grid" is 62,
 * so a hard 60 would drop the place that pattern exists to show.
 */
const PROJECT_TITLE_MAX = 62;

const FULL_CLOSER = "Planning status, location and grid connection details.";
const SHORT_CLOSER = "Planning status and connection details.";

/**
 * Region phrases. Title uses the shorter label when the spelled-out name does not fit.
 * "Offshore" is not a town, county or region a person would search.
 */
const REGION_PROSE: Record<string, string> = {
  "East Midlands": "the East Midlands",
  Eastern: "the East of England",
  London: "London",
  "North East": "the North East",
  "North West": "the North West",
  Scotland: "Scotland",
  "South East": "the South East",
  "South West": "the South West",
  Wales: "Wales",
  "West Midlands": "the West Midlands",
  "Yorkshire and Humber": "Yorkshire and the Humber",
};

const SOLAR_PV_SYSTEM = /\s*(?:[-–—]\s*)?solar PV system$/i;

const wordPatterns = new Map<string, RegExp>();

export type ProjectSeoInput = {
  name: string;
  technology: ProjectTechnology;
  powerMw: number | null;
  displayStage: DisplayStage;
  town?: string | null;
  localAuthority?: string | null;
  county?: string | null;
  region?: string | null;
  /** Used only when the region is missing or not a place, such as Offshore. */
  country?: string | null;
  developer?: string | null;
};

type PlaceOption = {
  title: string;
  prose: string;
};

function includesWord(name: string, word: string): boolean {
  let pattern = wordPatterns.get(word);
  if (!pattern) {
    pattern = new RegExp(`\\b${word}\\b`, "i");
    wordPatterns.set(word, pattern);
  }
  return pattern.test(name);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

function cleanDeveloper(value: string | null | undefined): string | null {
  const trimmed = clean(value)?.replace(/[.\s]+$/u, "") ?? null;
  if (!trimmed || /^(not available|unknown|n\/a)$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Distinctive site name: normalise REPD "Solar Pv", then drop a trailing system label and a secondary address. */
export function projectTitleName(name: string): string {
  const normalised = displayProjectName(name).replace(/\s+/g, " ").trim();
  const withoutSystem = normalised.replace(SOLAR_PV_SYSTEM, "").replace(/[-–—]\s*$/u, "").trim();
  const head = withoutSystem.length > 0 ? withoutSystem : normalised;
  const comma = head.indexOf(",");
  if (comma >= 3) {
    const distinctive = head.slice(0, comma).trim();
    if (distinctive.length >= 3) {
      return distinctive;
    }
  }
  return head;
}

/** Plain-English technology, lowercase except established acronyms. */
function projectTechnologyLabel(technology: ProjectTechnology, fullName: string): string {
  if (technology === "solar_pv" && includesWord(fullName, "agricultural")) {
    return "agricultural solar";
  }
  switch (technology) {
    case "solar_pv":
      return "solar";
    case "onshore_wind":
      return "onshore wind";
    case "offshore_wind":
      return "offshore wind";
    case "biomass":
      return "biomass";
    case "energy_from_waste":
      return "energy from waste";
    case "landfill_gas":
      return "landfill gas";
    case "anaerobic_digestion":
      return "anaerobic digestion";
    case "sewage_gas":
      return "sewage gas";
    case "advanced_conversion":
      return "advanced conversion";
    case "hydro":
      return "hydro";
    case "tidal":
      return "tidal";
    case "wave":
      return "wave";
    case "geothermal":
      return "geothermal";
    case "hydrogen":
      return "hydrogen";
    case "ccgt":
      return "CCGT";
    case "ocgt":
      return "OCGT";
    case "oil":
      return "oil";
    case "nuclear":
      return "nuclear";
    case "pumped_storage":
      return "pumped storage";
    case "battery":
      return "battery storage";
    case "liquid_air":
      return "liquid air storage";
    case "compressed_air":
      return "compressed air storage";
    case "flywheel":
      return "flywheel storage";
    case "heat_pump":
      return "heat pump";
    case "chp":
      return "CHP";
    case "gas_reciprocating":
      return "gas reciprocating";
    case "thermal":
      return "thermal";
    case "demand":
      return "demand";
    case "reactive_compensation":
      return "reactive compensation";
    case "interconnector":
      return "interconnector";
    case "substation":
      return "substation";
    case "unspecified":
      return "energy";
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}

function technologySuffix(shortName: string, label: string): string | null {
  if (
    label === "battery storage" &&
    (includesWord(shortName, "battery") ||
      includesWord(shortName, "bess") ||
      (includesWord(shortName, "energy") && includesWord(shortName, "storage")))
  ) {
    return null;
  }
  const words = label.split(" ");
  if (words.every((word) => includesWord(shortName, word))) {
    return null;
  }
  if (words.length > 1 && includesWord(shortName, words[0])) {
    const rest = words.slice(1).join(" ");
    if (rest.split(" ").every((word) => includesWord(shortName, word))) {
      return null;
    }
    return rest;
  }
  return label;
}

function capacityLabel(mw: number | null): string | null {
  if (mw == null || !Number.isFinite(mw) || mw <= 0) {
    return null;
  }
  const energy = formatEnergy(mw);
  return `${energy.value} ${energy.unit}`;
}

function indefinite(phrase: string): "a" | "an" {
  const word = phrase.trim().split(/\s+/)[0] ?? "";
  const number = /^(\d+)/.exec(word);
  if (number) {
    const head = Number(number[1]);
    if (head === 8 || head === 11 || head === 18 || (head >= 80 && head <= 89) || (head >= 800 && head <= 899)) {
      return "an";
    }
    return "a";
  }
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function pushPlace(options: PlaceOption[], title: string, prose: string) {
  if (options.some((option) => option.title.toLowerCase() === title.toLowerCase())) {
    return;
  }
  options.push({ title, prose });
}

function regionOptions(region: string): PlaceOption[] {
  if (/^offshore$/i.test(region)) {
    return [];
  }
  if (region === "Eastern") {
    return [
      { title: "East of England", prose: "in the East of England" },
      { title: "Eastern", prose: "in Eastern England" },
    ];
  }
  if (region === "Yorkshire and Humber") {
    return [
      { title: "Yorkshire and the Humber", prose: "in Yorkshire and the Humber" },
      { title: "Yorkshire and Humber", prose: "in Yorkshire and the Humber" },
    ];
  }
  const prose = REGION_PROSE[region] ?? region;
  return [{ title: region, prose: `in ${prose}` }];
}

/** Most specific human place first, then broader labels, then the region. */
function projectPlaceOptions(input: ProjectSeoInput): PlaceOption[] {
  const town = clean(input.town);
  const authority = clean(input.localAuthority);
  const county = clean(input.county);
  const region = clean(input.region);
  const country = clean(input.country);
  const options: PlaceOption[] = [];
  const locality = town ?? authority;
  if (locality && county && locality.toLowerCase() !== county.toLowerCase()) {
    pushPlace(options, `${locality}, ${county}`, `in ${locality}, ${county}`);
  }
  if (town) {
    pushPlace(options, town, `in ${town}`);
  }
  if (authority) {
    pushPlace(options, authority, `in ${authority}`);
  }
  if (county) {
    pushPlace(options, county, `in ${county}`);
  }
  const regionPlaces = region ? regionOptions(region) : [];
  if (regionPlaces.length > 0) {
    for (const option of regionPlaces) {
      pushPlace(options, option.title, option.prose);
    }
  } else if (country) {
    pushPlace(options, country, `in ${country}`);
  }
  return options;
}

function assembleTitle(
  name: string,
  capacity: string | null,
  technology: string | null,
  place: string | null,
  status: string,
): string {
  const detail = [capacity, technology].filter((part): part is string => Boolean(part)).join(" ");
  if (detail && place) {
    return `${name} ${detail}, ${place}: ${status}${SUFFIX}`;
  }
  if (detail) {
    return `${name} ${detail}: ${status}${SUFFIX}`;
  }
  if (place) {
    return `${name}, ${place}: ${status}${SUFFIX}`;
  }
  return `${name}: ${status}${SUFFIX}`;
}

/**
 * `{Name} {capacity} {technology}, {place}: {status} | Grid`.
 * Capacity is dropped before any place, then the place is shortened, and the name is left whole.
 */
export function projectDetailTitle(input: ProjectSeoInput): string {
  const name = projectTitleName(input.name);
  const status = displayStageLabel(input.displayStage).toLowerCase();
  const technology = technologySuffix(name, projectTechnologyLabel(input.technology, input.name));
  const capacity = capacityLabel(input.powerMw);
  const places = projectPlaceOptions(input).map((option) => option.title);

  if (capacity) {
    const withCapacity = assembleTitle(name, capacity, technology, places[0] ?? null, status);
    if (pageTitleLength(withCapacity) <= PROJECT_TITLE_MAX) {
      return withCapacity;
    }
  }

  for (const place of places) {
    const title = assembleTitle(name, null, technology, place, status);
    if (pageTitleLength(title) <= PROJECT_TITLE_MAX) {
      return title;
    }
  }

  if (capacity && places.length > 0) {
    const capacityOnly = assembleTitle(name, capacity, technology, null, status);
    if (pageTitleLength(capacityOnly) <= PROJECT_TITLE_MAX) {
      return capacityOnly;
    }
  }

  return assembleTitle(name, null, technology, null, status);
}

function descriptionSentence(parts: {
  name: string;
  technology: string;
  capacity: string | null;
  place: string | null;
  developer: string | null;
  status: string;
  closer: string | null;
}): string {
  const sized = [parts.capacity, parts.technology].filter((part): part is string => Boolean(part)).join(" ");
  const where = parts.place ? ` ${parts.place}` : "";
  const from = parts.developer ? `, from ${parts.developer}` : "";
  const closer = parts.closer ? ` ${parts.closer}` : "";
  return `${parts.name} is ${indefinite(sized)} ${sized} project${where}${from}. ${parts.status}.${closer}`;
}

function clipWords(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) {
    return text;
  }
  const sliced = chars.slice(0, max).join("");
  const atWord = sliced.replace(/\s+\S*$/u, "").trimEnd();
  if (atWord.length > 0) {
    return atWord;
  }
  return text.split(/\s+/)[0] ?? sliced.trimEnd();
}

function clipDescription(name: string, technology: string, status: string): string {
  const tail = ` is ${indefinite(technology)} ${technology} project. ${status}.`;
  const full = `${name}${tail}`;
  if (pageDescriptionLength(full) <= DESCRIPTION_MAX_CHARS) {
    return full;
  }
  const room = DESCRIPTION_MAX_CHARS - pageDescriptionLength(tail);
  if (room > 0) {
    const clipped = clipWords(name, room);
    const sentence = `${clipped}${tail}`;
    if (clipped.length > 0 && pageDescriptionLength(sentence) <= DESCRIPTION_MAX_CHARS) {
      return sentence;
    }
  }
  return clipWords(full, DESCRIPTION_MAX_CHARS);
}

/** One sentence that names the technology, capacity, place, status and applicant when they fit. */
export function projectDetailDescription(input: ProjectSeoInput): string {
  const name = projectTitleName(input.name);
  const technology = projectTechnologyLabel(input.technology, input.name);
  const status = displayStageLabel(input.displayStage);
  const capacity = capacityLabel(input.powerMw);
  const developer = cleanDeveloper(input.developer);
  const places = projectPlaceOptions(input);
  const capacities = capacity ? [capacity, null] : [null];
  const developers = developer ? [developer, null] : [null];
  const closers = [FULL_CLOSER, SHORT_CLOSER, null];

  for (const place of [...places, null]) {
    for (const cap of capacities) {
      for (const closer of closers) {
        for (const dev of developers) {
          const text = descriptionSentence({
            name,
            technology,
            capacity: cap,
            place: place?.prose ?? null,
            developer: dev,
            status,
            closer,
          });
          if (pageDescriptionLength(text) <= DESCRIPTION_MAX_CHARS) {
            return text;
          }
        }
      }
    }
  }

  return clipDescription(name, technology, status);
}

export function projectSeoTitle(project: EnergyProject): string {
  return projectDetailTitle({
    name: project.name,
    technology: project.technology,
    powerMw: project.power_mw,
    displayStage: project.display_stage,
    region: project.region,
    country: project.country,
  });
}

export function projectSeoDescription(project: EnergyProject): string {
  return projectDetailDescription({
    name: project.name,
    technology: project.technology,
    powerMw: project.power_mw,
    displayStage: project.display_stage,
    region: project.region,
    country: project.country,
  });
}
