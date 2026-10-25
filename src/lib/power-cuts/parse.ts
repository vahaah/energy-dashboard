import { nationOfPostcode, ngedArea, npgArea, ukpnArea } from "@/lib/power-cuts/areas";
import { csvRecords } from "@/lib/power-cuts/csv";
import { parseIrishPair } from "@/lib/power-cuts/irish-grid";
import {
  powerCutSchema,
  type Operator,
  type PowerCut,
  type PowerCutKind,
} from "@/lib/power-cuts/schema";
import { normalizePostcode } from "@/lib/postcode/parse";
import { parsePostcodeSector, postcodeSectorPoint, type SectorPointLookup } from "@/lib/postcode/sector";
import { parseNieTimestamp, parseUtcTimestamp } from "@/lib/power-cuts/time";

export const UKPN_SOURCE_URL = "https://ukpowernetworks.opendatasoft.com/explore/dataset/ukpn-live-faults/";
export const NPG_SOURCE_URL = "https://northernpowergrid.opendatasoft.com/explore/dataset/live-power-cuts-data/";
export const NGED_SOURCE_URL = "https://connecteddata.nationalgrid.co.uk/dataset/d6672e1e-c684-4cea-bb78-c7e5248b62a2";
export const ENW_SOURCE_URL = "https://electricitynorthwest.opendatasoft.com/explore/dataset/live_incidents/";
export const SPEN_SOURCE_URL = "https://spenergynetworks.opendatasoft.com/explore/dataset/distribution-network-live-outages/";
export const SSEN_SOURCE_URL = "https://ssen-powertrack-api.opcld.com/gridiview/reporter/info/livefaults";
export const NIE_SOURCE_URL = "https://powercheck.nienetworks.co.uk/NIEPowerCheckerWebAPI/api/faults";

const RESTORED = /^(restored|complete|completed)$/i;

export function cleanPostcodes(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const value of values) {
    for (const part of value.split(/[;,]/)) {
      const token = part.trim();
      if (!token) {
        continue;
      }
      const full = normalizePostcode(token);
      const sector = full ? null : parsePostcodeSector(token);
      const label = full ? `${full.outward} ${full.inward}` : sector?.label;
      if (!label) {
        continue;
      }
      const key = label.replace(/\s+/g, "");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      labels.push(label);
    }
  }
  return labels;
}

export function finishPoint(longitude: number, latitude: number): [number, number] | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  const lon = Math.round(longitude * 1e5) / 1e5;
  const lat = Math.round(latitude * 1e5) / 1e5;
  if (lon === 0 && lat === 0) {
    return null;
  }
  if (lon < -12 || lon > 3 || lat < 49 || lat > 61) {
    return null;
  }
  return [lon, lat];
}

function customers(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rowsOf(value: unknown, keys: readonly string[]): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const object = record(value);
  if (!object) {
    return [];
  }
  for (const key of keys) {
    const nested = object[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }
  return [];
}

function accept(row: PowerCut): PowerCut | null {
  const parsed = powerCutSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

function pointFrom(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Math.abs(first) > 40 && Math.abs(second) < 20) {
      return finishPoint(second, first);
    }
    return finishPoint(first, second);
  }
  const object = record(value);
  if (!object) {
    return null;
  }
  const longitude = object.lon ?? object.lng;
  const latitude = object.lat;
  if (typeof longitude === "number" || typeof longitude === "string") {
    return finishPoint(Number(longitude), Number(latitude));
  }
  return null;
}

export function parseUkpn(payload: unknown): PowerCut[] {
  const incidents: PowerCut[] = [];
  for (const item of rowsOf(payload, ["results"])) {
    const row = record(item);
    if (!row) {
      continue;
    }
    const type = text(row.powercuttype);
    if (type !== "Planned" && type !== "Unplanned") {
      continue;
    }
    const sourceId = text(row.incidentreference);
    const startedAt = parseUtcTimestamp(row.creationdatetime);
    const postcodes = cleanPostcodes([text(row.postcodesaffected)]);
    const area = ukpnArea(text(row.operatingzone) || null, postcodes);
    if (!sourceId || !startedAt || !area) {
      continue;
    }
    const cut = accept({
      id: `ukpn:${sourceId}`,
      operator: "ukpn",
      area,
      nation: "England",
      kind: type === "Planned" ? "planned" : "unplanned",
      status: "active",
      startedAt,
      estimatedRestorationAt: parseUtcTimestamp(row.estimatedrestorationdate),
      customersOff: customers(type === "Planned" ? row.noplannedcustomers : row.nocustomeraffected),
      postcodes,
      point: pointFrom(row.geopoint),
      sourceUrl: UKPN_SOURCE_URL,
    });
    if (cut) {
      incidents.push(cut);
    }
  }
  return incidents;
}

type NpgGroup = {
  sourceId: string;
  customersOff: number | null;
  kind: PowerCutKind;
  startedAt: string;
  estimatedRestorationAt: string | null;
  area: ReturnType<typeof npgArea>;
  postcodes: string[];
  point: [number, number] | null;
};

export function parseNpg(payload: unknown): PowerCut[] {
  const groups = new Map<string, NpgGroup>();
  for (const item of rowsOf(payload, ["results"])) {
    const row = record(item);
    if (!row) {
      continue;
    }
    const incidentId = text(row.incidentid);
    const reference = text(row.reference);
    const sourceId = incidentId || reference;
    if (!sourceId) {
      continue;
    }
    const area = npgArea(text(row.area));
    const startedAt = parseUtcTimestamp(row.loggedtime);
    if (!area || !startedAt) {
      continue;
    }
    const postcodeField = row.postcode;
    const rawPostcodes = Array.isArray(postcodeField)
      ? postcodeField.filter((value): value is string => typeof value === "string")
      : [text(postcodeField)];
    const confirmed = customers(row.totalconfirmedpowercut);
    const existing = groups.get(sourceId);
    const point = finishPoint(Number(row.lng), Number(row.lat));
    if (!existing) {
      groups.set(sourceId, {
        sourceId,
        customersOff: confirmed,
        kind: /planned/i.test(text(row.natureofoutage)) ? "planned" : "unplanned",
        startedAt,
        estimatedRestorationAt: parseUtcTimestamp(row.estimatedtimetillresolution),
        area,
        postcodes: cleanPostcodes(rawPostcodes),
        point,
      });
      continue;
    }
    existing.postcodes = cleanPostcodes([...existing.postcodes, ...rawPostcodes]);
    if (existing.point == null && point) {
      existing.point = point;
    }
    if (confirmed != null && (existing.customersOff == null || confirmed > existing.customersOff)) {
      existing.customersOff = confirmed;
    }
  }
  const incidents: PowerCut[] = [];
  for (const group of groups.values()) {
    if (!group.area) {
      continue;
    }
    const cut = accept({
      id: `npg:${group.sourceId}`,
      operator: "npg",
      area: group.area,
      nation: "England",
      kind: group.kind,
      status: "active",
      startedAt: group.startedAt,
      estimatedRestorationAt: group.estimatedRestorationAt,
      customersOff: group.customersOff,
      postcodes: group.postcodes,
      point: group.point,
      sourceUrl: NPG_SOURCE_URL,
    });
    if (cut) {
      incidents.push(cut);
    }
  }
  return incidents;
}

export function parseNged(payload: string): PowerCut[] {
  const incidents: PowerCut[] = [];
  for (const row of csvRecords(payload)) {
    const status = row.Status ?? "";
    if (RESTORED.test(status.trim())) {
      continue;
    }
    const placed = ngedArea(row.Region ?? "");
    const sourceId = (row["Incident ID"] ?? "").trim();
    const startedAt = parseUtcTimestamp(row["Start Time"]);
    if (!placed || !sourceId || !startedAt) {
      continue;
    }
    const planned = (row.Planned ?? "").trim().toLowerCase() === "true";
    const cut = accept({
      id: `nged:${sourceId}`,
      operator: "nged",
      area: placed.area,
      nation: placed.nation,
      kind: planned ? "planned" : "unplanned",
      status: "active",
      startedAt,
      estimatedRestorationAt: parseUtcTimestamp(row.ETR),
      customersOff: customers(row["Confirmed Off"]),
      postcodes: cleanPostcodes([row.Postcodes ?? ""]),
      point: finishPoint(Number(row["Location Longitude"]), Number(row["Location Latitude"])),
      sourceUrl: NGED_SOURCE_URL,
    });
    if (cut) {
      incidents.push(cut);
    }
  }
  return incidents;
}

export function parseEnw(payload: unknown): PowerCut[] {
  const incidents: PowerCut[] = [];
  for (const item of rowsOf(payload, ["results"])) {
    const row = record(item);
    if (!row) {
      continue;
    }
    if (RESTORED.test(text(row.incident_status))) {
      continue;
    }
    const sourceId = text(row.incident_num);
    const startedAt = parseUtcTimestamp(row.outage_time);
    if (!sourceId || !startedAt) {
      continue;
    }
    const off = customers(row.customers_off_supply);
    const cut = accept({
      id: `enw:${sourceId}`,
      operator: "enw",
      area: "ENW",
      nation: "England",
      kind: /plan/i.test(text(row.incident_type)) && !/unplanned/i.test(text(row.incident_type)) ? "planned" : "unplanned",
      status: "active",
      startedAt,
      estimatedRestorationAt: parseUtcTimestamp(row.estimated_restoration_time),
      customersOff: off ?? customers(row.customers_affected),
      postcodes: [],
      point: pointFrom(row.geo_point_2d),
      sourceUrl: ENW_SOURCE_URL,
    });
    if (cut) {
      incidents.push(cut);
    }
  }
  return incidents;
}

export function parseSpen(payload: unknown, lookup?: SectorPointLookup): PowerCut[] {
  const incidents: PowerCut[] = [];
  for (const item of rowsOf(payload, ["results"])) {
    const row = record(item);
    if (!row) {
      continue;
    }
    if (RESTORED.test(text(row.status))) {
      continue;
    }
    const sourceId = text(row.fault_id);
    const licence = text(row.licence_area).toUpperCase();
    const sector = text(row.postcode_sector);
    const planned = row.planned === true || text(row.planned).toLowerCase() === "true";
    const startedAt = parseUtcTimestamp(planned ? row.planned_outage_start_date : row.date_of_reported_fault);
    if (!sourceId || !startedAt) {
      continue;
    }
    const postcodes = cleanPostcodes([sector]);
    let area: PowerCut["area"] | null = null;
    let nation: PowerCut["nation"] | null = null;
    if (licence === "SPD") {
      area = "SPD";
      nation = "Scotland";
    } else if (licence === "SPM") {
      area = "SPM";
      nation = nationOfPostcode(sector);
    }
    if (!area || !nation) {
      continue;
    }
    const cut = accept({
      id: `spen:${sourceId}`,
      operator: "spen",
      area,
      nation,
      kind: planned ? "planned" : "unplanned",
      status: "active",
      startedAt,
      estimatedRestorationAt: parseUtcTimestamp(row.etr),
      customersOff: null,
      postcodes,
      point: sector ? postcodeSectorPoint(sector, lookup) : null,
      sourceUrl: SPEN_SOURCE_URL,
    });
    if (cut) {
      incidents.push(cut);
    }
  }
  return incidents;
}

export function parseSsen(payload: unknown): PowerCut[] {
  const incidents: PowerCut[] = [];
  for (const item of rowsOf(payload, ["Faults", "faults"])) {
    const row = record(item);
    if (!row || row.resolved === true) {
      continue;
    }
    const sourceId = text(row.reference);
    const startedAt = parseUtcTimestamp(row.loggedAt);
    const network = text(row.networkId).toLowerCase();
    const area = network.includes("shepd") ? "SHEPD" : network.includes("sepd") ? "SEPD" : null;
    const nation = area === "SHEPD" ? "Scotland" : area === "SEPD" ? "England" : null;
    if (!sourceId || !startedAt || !area || !nation) {
      continue;
    }
    const areas = Array.isArray(row.affectedAreas)
      ? row.affectedAreas.filter((value): value is string => typeof value === "string")
      : [];
    const type = text(row.type);
    const cut = accept({
      id: `ssen:${sourceId}`,
      operator: "ssen",
      area,
      nation,
      kind: /plan/i.test(type) ? "planned" : "unplanned",
      status: "active",
      startedAt,
      estimatedRestorationAt: parseUtcTimestamp(row.estimatedRestoration),
      customersOff: customers(row.affectedCustomerCount),
      postcodes: cleanPostcodes(areas),
      point: finishPoint(Number(row.longitude), Number(row.latitude)),
      sourceUrl: SSEN_SOURCE_URL,
    });
    if (cut) {
      incidents.push(cut);
    }
  }
  return incidents;
}

export function parseNie(payload: unknown, now: Date): PowerCut[] {
  const incidents: PowerCut[] = [];
  for (const item of rowsOf(payload, ["outageMessage", "faults"])) {
    const row = record(item);
    if (!row) {
      continue;
    }
    const sourceId = text(row.outageId);
    const startedAt = parseNieTimestamp(row.startTime, now);
    if (!sourceId || !startedAt) {
      continue;
    }
    const type = text(row.outageType);
    const coordinates = record(row.point)?.coordinates;
    const cut = accept({
      id: `nie:${sourceId}`,
      operator: "nie",
      area: "NI",
      nation: "Northern Ireland",
      kind: /plan/i.test(type) && !/fault/i.test(type) ? "planned" : "unplanned",
      status: "active",
      startedAt,
      estimatedRestorationAt: parseNieTimestamp(row.estRestoreFullDateTime, now),
      customersOff: customers(row.numCustAffected),
      postcodes: cleanPostcodes([text(row.postCode)]),
      point: parseIrishPair(coordinates),
      sourceUrl: NIE_SOURCE_URL,
    });
    if (cut) {
      incidents.push(cut);
    }
  }
  return incidents;
}

export function parseOperator(operator: Operator, payload: unknown, now: Date, lookup?: SectorPointLookup): PowerCut[] {
  switch (operator) {
    case "ukpn":
      return parseUkpn(payload);
    case "npg":
      return parseNpg(payload);
    case "nged":
      return typeof payload === "string" ? parseNged(payload) : [];
    case "enw":
      return parseEnw(payload);
    case "spen":
      return parseSpen(payload, lookup);
    case "ssen":
      return parseSsen(payload);
    case "nie":
      return parseNie(payload, now);
    default: {
      const exhaustive: never = operator;
      return exhaustive;
    }
  }
}
