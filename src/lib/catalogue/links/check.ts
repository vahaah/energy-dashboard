import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stableId } from "@/lib/catalogue/assets/ids";
import { isOrigin } from "@/lib/map/origin";
import {
  GAS_PIN_BBOX,
  LINK_FILES,
  RESIDUAL_IMPORTS_CODE,
  SCHEMATIC_BBOX,
  gasTerminalsFileSchema,
  interconnectorsFileSchema,
  type GasTerminalRecord,
  type InterconnectorRecord,
} from "@/lib/catalogue/links/schema";

type BBox = { west: number; south: number; east: number; north: number };

export function outsideBox(longitude: number, latitude: number, box: BBox): boolean {
  return longitude < box.west || longitude > box.east || latitude < box.south || latitude > box.north;
}

function endpointError(label: string, longitude: number, latitude: number, box: BBox): string | null {
  if (isOrigin(longitude, latitude)) {
    return `${label} is (0, 0)`;
  }
  if (outsideBox(longitude, latitude, box)) {
    return `${label} is outside the schematic box`;
  }
  return null;
}

export function interconnectorErrors(records: readonly InterconnectorRecord[], plantIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const record of records) {
    if (record.fuelinst_code === RESIDUAL_IMPORTS_CODE) {
      errors.push(`${record.fuelinst_code} is the residual imports bucket and is not drawn`);
    }
    const expected = stableId("ast", `grid:interconnector:${record.fuelinst_code}`);
    if (record.interconnector_id !== expected) {
      errors.push(`${record.fuelinst_code} id is not ${expected}`);
    }
    if (ids.has(record.interconnector_id)) {
      errors.push(`duplicate interconnector id ${record.interconnector_id}`);
    }
    ids.add(record.interconnector_id);
    if (plantIds.has(record.interconnector_id)) {
      errors.push(`${record.interconnector_id} collides with a plant asset`);
    }
    if (codes.has(record.fuelinst_code)) {
      errors.push(`duplicate fuelinst code ${record.fuelinst_code}`);
    }
    codes.add(record.fuelinst_code);
    const gb = endpointError(
      `${record.fuelinst_code} gb`,
      record.gb_longitude,
      record.gb_latitude,
      SCHEMATIC_BBOX,
    );
    const remote = endpointError(
      `${record.fuelinst_code} remote`,
      record.remote_longitude,
      record.remote_latitude,
      SCHEMATIC_BBOX,
    );
    if (gb) {
      errors.push(gb);
    }
    if (remote) {
      errors.push(remote);
    }
  }
  return errors;
}

export function gasTerminalErrors(records: readonly GasTerminalRecord[], plantIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const record of records) {
    const expected = stableId("ast", `grid:gas-terminal:${record.key}`);
    if (record.asset_id !== expected) {
      errors.push(`${record.key} id is not ${expected}`);
    }
    if (ids.has(record.asset_id)) {
      errors.push(`duplicate gas terminal id ${record.asset_id}`);
    }
    ids.add(record.asset_id);
    if (plantIds.has(record.asset_id)) {
      errors.push(`${record.asset_id} collides with a plant asset`);
    }
    if (keys.has(record.key)) {
      errors.push(`duplicate gas terminal key ${record.key}`);
    }
    keys.add(record.key);
    const hasLatitude = record.latitude !== null;
    const hasLongitude = record.longitude !== null;
    if (hasLatitude !== hasLongitude) {
      errors.push(`${record.key} needs both coordinates or neither`);
      continue;
    }
    if (!hasLatitude || record.latitude === null || record.longitude === null) {
      if (record.coordinate_licence || record.coordinate_licence_url || record.coordinate_citation) {
        errors.push(`${record.key} cites a coordinate it does not store`);
      }
      continue;
    }
    if (!record.coordinate_licence || !record.coordinate_licence_url || !record.coordinate_citation) {
      errors.push(`${record.key} pin has no permitted coordinate licence`);
    }
    const pin = endpointError(record.key, record.longitude, record.latitude, GAS_PIN_BBOX);
    if (pin) {
      errors.push(pin);
    }
  }
  return errors;
}

function readJson(dir: string, file: string): { text: string } | { error: string } {
  const path = join(dir, file);
  if (!existsSync(path)) {
    return { error: `missing ${file}` };
  }
  return { text: readFileSync(path, "utf8") };
}

function plantIds(dir: string): Set<string> {
  const path = join(dir, "assets.ndjson");
  if (!existsSync(path)) {
    return new Set();
  }
  const ids = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      const value = JSON.parse(line) as { asset_id?: unknown };
      if (typeof value.asset_id === "string") {
        ids.add(value.asset_id);
      }
    } catch {
      ids.add("unreadable");
    }
  }
  return ids;
}

export function checkLinkFiles(dir: string, options: { required: boolean }): string[] {
  const interconnectorPath = join(dir, LINK_FILES.interconnectors);
  const gasPath = join(dir, LINK_FILES.gasTerminals);
  const present = existsSync(interconnectorPath) || existsSync(gasPath);
  if (!present) {
    return options.required ? [`missing ${LINK_FILES.interconnectors}`, `missing ${LINK_FILES.gasTerminals}`] : [];
  }
  const errors: string[] = [];
  const interconnectors = readJson(dir, LINK_FILES.interconnectors);
  const gas = readJson(dir, LINK_FILES.gasTerminals);
  if ("error" in interconnectors) {
    errors.push(interconnectors.error);
  }
  if ("error" in gas) {
    errors.push(gas.error);
  }
  if ("error" in interconnectors || "error" in gas) {
    return errors;
  }
  let interconnectorJson: unknown;
  let gasJson: unknown;
  try {
    interconnectorJson = JSON.parse(interconnectors.text);
  } catch {
    errors.push(`${LINK_FILES.interconnectors}: invalid JSON`);
  }
  try {
    gasJson = JSON.parse(gas.text);
  } catch {
    errors.push(`${LINK_FILES.gasTerminals}: invalid JSON`);
  }
  if (errors.length > 0 || interconnectorJson === undefined || gasJson === undefined) {
    return errors;
  }
  const parsedInterconnectors = interconnectorsFileSchema.safeParse(interconnectorJson);
  const parsedGas = gasTerminalsFileSchema.safeParse(gasJson);
  if (!parsedInterconnectors.success) {
    errors.push(`${LINK_FILES.interconnectors}: ${parsedInterconnectors.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  if (!parsedGas.success) {
    errors.push(`${LINK_FILES.gasTerminals}: ${parsedGas.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  if (!parsedInterconnectors.success || !parsedGas.success) {
    return errors;
  }
  const plants = plantIds(dir);
  errors.push(...interconnectorErrors(parsedInterconnectors.data, plants));
  errors.push(...gasTerminalErrors(parsedGas.data, plants));
  const shared = new Set<string>();
  for (const record of parsedInterconnectors.data) {
    shared.add(record.interconnector_id);
  }
  for (const record of parsedGas.data) {
    if (shared.has(record.asset_id)) {
      errors.push(`${record.asset_id} is both an interconnector and a gas terminal`);
    }
  }
  return errors;
}
