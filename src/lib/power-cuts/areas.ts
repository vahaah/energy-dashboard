import { normalizePostcode } from "@/lib/postcode/parse";
import { parsePostcodeSector } from "@/lib/postcode/sector";
import type { Area, Nation } from "@/lib/power-cuts/schema";

const UKPN_ZONE_AREA: Record<string, Area> = {
  aylesbury: "EPN",
  bedford: "EPN",
  borehamwood: "EPN",
  broadland: "EPN",
  "bury st edmunds": "EPN",
  cambridge: "EPN",
  chelmsford: "EPN",
  clacton: "EPN",
  harlow: "EPN",
  "hemel hempstead": "EPN",
  ipswich: "EPN",
  "kings lynn": "EPN",
  luton: "EPN",
  norwich: "EPN",
  peterborough: "EPN",
  rayleigh: "EPN",
  "st albans": "EPN",
  stevenage: "EPN",
  central: "LPN",
  enfield: "LPN",
  "harold hill": "LPN",
  "north east": "LPN",
  "north west": "LPN",
  pinner: "LPN",
  "south east": "LPN",
  "south west": "LPN",
  "brighton zone": "SPN",
  "croydon zone": "SPN",
  "east kent zone": "SPN",
  "east sussex zone": "SPN",
  "kingston zone": "SPN",
  "mid kent zone": "SPN",
  "west kent zone": "SPN",
  "west sussex zone": "SPN",
};

const EPN_AREAS = new Set(["AL", "CB", "CM", "CO", "HP", "IP", "LU", "MK", "NR", "PE", "SG", "SS"]);
const LPN_AREAS = new Set(["E", "EC", "N", "NW", "SE", "SW", "W", "WC", "HA", "IG", "RM", "UB", "EN"]);
const SPN_AREAS = new Set(["BN", "BR", "CR", "CT", "DA", "GU", "KT", "ME", "RH", "SM", "TN", "TW"]);

const WALES_AREAS = new Set(["CF", "LD", "LL", "NP", "SA"]);
const SCOTLAND_AREAS = new Set(["AB", "DD", "DG", "EH", "FK", "G", "HS", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "ZE"]);
const WALES_OUTCODES = new Set(["CH5", "CH6", "CH7", "CH8", "SY15", "SY16", "SY17", "SY18", "SY19", "SY20", "SY21", "SY22", "SY23", "SY24", "SY25"]);
const ENGLAND_OUTCODES = new Set(["CH1", "CH2", "CH3", "CH4", "CH41", "CH42", "CH43", "CH44", "CH45", "CH46", "CH47", "CH48", "CH49", "CH60", "CH61", "CH62", "CH63", "CH64", "CH65", "CH66", "SY1", "SY2", "SY3", "SY4", "SY5", "SY6", "SY7", "SY8", "SY9", "SY10", "SY11", "SY12", "SY13", "SY14"]);

export function ukpnArea(zone: string | null, postcodes: readonly string[]): Area | null {
  if (zone) {
    const mapped = UKPN_ZONE_AREA[zone.trim().toLowerCase()];
    if (mapped) {
      return mapped;
    }
  }
  const outward = firstOutward(postcodes);
  if (!outward) {
    return null;
  }
  const area = outward.replace(/\d.*/, "");
  if (EPN_AREAS.has(area)) {
    return "EPN";
  }
  if (LPN_AREAS.has(area)) {
    return "LPN";
  }
  if (SPN_AREAS.has(area)) {
    return "SPN";
  }
  return null;
}

export function ngedArea(region: string): { area: Area; nation: Nation } | null {
  switch (region.trim().toLowerCase()) {
    case "east midlands":
      return { area: "EMID", nation: "England" };
    case "west midlands":
      return { area: "WMID", nation: "England" };
    case "south wales":
      return { area: "SWALES", nation: "Wales" };
    case "south west":
      return { area: "SWEST", nation: "England" };
    default:
      return null;
  }
}

export function areaName(area: Area): string {
  switch (area) {
    case "EPN":
      return "East of England";
    case "LPN":
      return "London";
    case "SPN":
      return "South East";
    case "SHEPD":
      return "North of Scotland";
    case "SEPD":
      return "South of England";
    case "EMID":
      return "East Midlands";
    case "WMID":
      return "West Midlands";
    case "SWALES":
      return "South Wales";
    case "SWEST":
      return "South West";
    case "NE":
      return "North East";
    case "YORKS":
      return "Yorkshire";
    case "ENW":
      return "North West";
    case "SPD":
      return "Central and southern Scotland";
    case "SPM":
      return "North Wales, Merseyside and Cheshire";
    case "NI":
      return "Northern Ireland";
    default: {
      const exhaustive: never = area;
      return exhaustive;
    }
  }
}

export function npgArea(area: string): Area | null {
  switch (area.trim().toLowerCase()) {
    case "north east":
      return "NE";
    case "yorkshire":
      return "YORKS";
    default:
      return null;
  }
}

/** Nation of a GB postcode or sector. Null when the outward code is not decisive. */
export function nationOfPostcode(value: string): Nation | null {
  const outward = outwardOf(value);
  if (!outward) {
    return null;
  }
  if (outward.startsWith("BT")) {
    return "Northern Ireland";
  }
  if (WALES_OUTCODES.has(outward) || WALES_AREAS.has(outwardArea(outward))) {
    return "Wales";
  }
  if (ENGLAND_OUTCODES.has(outward)) {
    return "England";
  }
  if (SCOTLAND_AREAS.has(outwardArea(outward))) {
    return "Scotland";
  }
  if (outwardArea(outward).length > 0) {
    return "England";
  }
  return null;
}

function firstOutward(postcodes: readonly string[]): string | null {
  for (const value of postcodes) {
    const outward = outwardOf(value);
    if (outward) {
      return outward;
    }
  }
  return null;
}

function outwardOf(value: string): string | null {
  const postcode = normalizePostcode(value);
  if (postcode) {
    return postcode.outward;
  }
  return parsePostcodeSector(value)?.outward ?? null;
}

function outwardArea(outward: string): string {
  return outward.replace(/\d[\dA-Z]*$/, "");
}
