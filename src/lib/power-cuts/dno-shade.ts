import type { Area, PowerCut } from "@/lib/power-cuts/schema";

/** Checked-in NESO DNO licence areas, edition 20240503. */
export const POWER_CUTS_DNO_GEOJSON = "/tiles/layers/dno/20240503.geojson";

export const POSTCODE_PREVIEW = 5;

export type AreaShade = "planned" | "unplanned";

/** NESO `Area` name for a power-cut area. Northern Ireland is not on this layer. */
export function licenceAreaName(area: Area): string | null {
  switch (area) {
    case "EPN":
      return "East England";
    case "LPN":
      return "London";
    case "SPN":
      return "South East England";
    case "SHEPD":
      return "North Scotland";
    case "SEPD":
      return "Southern England";
    case "EMID":
      return "East Midlands";
    case "WMID":
      return "West Midlands";
    case "SWALES":
      return "South Wales";
    case "SWEST":
      return "South West England";
    case "NE":
      return "North East England";
    case "YORKS":
      return "Yorkshire";
    case "ENW":
      return "North West England";
    case "SPD":
      return "South and Central Scotland";
    case "SPM":
      return "North Wales, Merseyside and Cheshire";
    case "NI":
      return null;
    default: {
      const exhaustive: never = area;
      return exhaustive;
    }
  }
}

/** One shade per licence area. An unplanned cut wins over a planned one. */
export function shadeByLicenceArea(incidents: readonly PowerCut[]): Map<string, AreaShade> {
  const shades = new Map<string, AreaShade>();
  for (const incident of incidents) {
    const name = licenceAreaName(incident.area);
    if (!name) {
      continue;
    }
    switch (incident.kind) {
      case "unplanned":
        shades.set(name, "unplanned");
        break;
      case "planned":
        if (shades.get(name) !== "unplanned") {
          shades.set(name, "planned");
        }
        break;
      default: {
        const exhaustive: never = incident.kind;
        return exhaustive;
      }
    }
  }
  return shades;
}

export function postcodePreview(postcodes: readonly string[]): { count: number; shown: string[]; rest: number } {
  const shown = postcodes.slice(0, POSTCODE_PREVIEW);
  return { count: postcodes.length, shown, rest: postcodes.length - shown.length };
}
