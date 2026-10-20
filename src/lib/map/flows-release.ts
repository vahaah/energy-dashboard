import { revalidatePath } from "next/cache";
import { getInterconnectorQueryParams } from "@/lib/dashboard-data";
import { gasStore, mutablePut } from "@/lib/gas/blob";
import { fetchJson } from "@/lib/http";
import type { InterconnectorFlow } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";
import {
  NESO_INTERCONNECTOR_REGISTER_RESOURCE,
  capacityFromRegister,
  capacityRowsFromCkan,
  type CapacityRelease,
} from "@/lib/map/capacity";
import { compactElectricity, type ElectricityFlowsRelease } from "@/lib/map/electricity-release";
import {
  GAS_FLOW_TIMEOUT_MS,
  GAS_INSTANTANEOUS_URL,
  parseInstantaneousFlows,
  rollGasHistory,
  type GasTerminalFlowsRelease,
} from "@/lib/map/gas-terminal-flows";

/** Legacy combined pointer. Read only when a per-feed file is missing. Writers do not touch it. */
export const MAP_FLOWS_LATEST = "releases/map/flows/latest.json";
export const MAP_FLOWS_PREVIOUS = "releases/map/flows/previous.json";
export const MAP_FLOWS_ELECTRICITY = "releases/map/flows/latest/electricity.json";
export const MAP_FLOWS_ELECTRICITY_PREVIOUS = "releases/map/flows/previous/electricity.json";
export const MAP_FLOWS_GAS = "releases/map/flows/latest/gas.json";
export const MAP_FLOWS_GAS_PREVIOUS = "releases/map/flows/previous/gas.json";
export const MAP_STATIONS_LATEST = "releases/map/stations/latest.json";

export const NESO_CAPACITY_SQL_URL = "https://api.neso.energy/api/3/action/datastore_search_sql";

const FETCH_ATTEMPTS = 2;
const CAPACITY_TIMEOUT_MS = 20_000;

export type MapFlowsRelease = {
  generated_at: string;
  electricity: ElectricityFlowsRelease | null;
  gas: GasTerminalFlowsRelease | null;
  capacity: CapacityRelease | null;
};

type ElectricityPointer = {
  generated_at: string;
  electricity: ElectricityFlowsRelease | null;
  capacity: CapacityRelease | null;
};

type GasPointer = {
  generated_at: string;
  gas: GasTerminalFlowsRelease | null;
};

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function parseMapFlowsRelease(text: string): MapFlowsRelease | null {
  try {
    const parsed = JSON.parse(text) as MapFlowsRelease;
    if (!parsed || typeof parsed.generated_at !== "string") {
      return null;
    }
    return {
      generated_at: parsed.generated_at,
      electricity: parsed.electricity ?? null,
      gas: parsed.gas ?? null,
      capacity: parsed.capacity ?? null,
    };
  } catch {
    return null;
  }
}

function parseElectricityPointer(text: string): ElectricityPointer | null {
  try {
    const parsed = JSON.parse(text) as ElectricityPointer;
    if (!parsed || typeof parsed.generated_at !== "string") {
      return null;
    }
    return {
      generated_at: parsed.generated_at,
      electricity: parsed.electricity ?? null,
      capacity: parsed.capacity ?? null,
    };
  } catch {
    return null;
  }
}

function parseGasPointer(text: string): GasPointer | null {
  try {
    const parsed = JSON.parse(text) as GasPointer;
    if (!parsed || typeof parsed.generated_at !== "string") {
      return null;
    }
    return {
      generated_at: parsed.generated_at,
      gas: parsed.gas ?? null,
    };
  } catch {
    return null;
  }
}

async function readElectricityPointer(): Promise<ElectricityPointer | null> {
  const stored = await gasStore().get(MAP_FLOWS_ELECTRICITY, false);
  return stored ? parseElectricityPointer(stored.body) : null;
}

async function readGasPointer(): Promise<GasTerminalFlowsRelease | null> {
  const stored = await gasStore().get(MAP_FLOWS_GAS, false);
  return stored ? (parseGasPointer(stored.body)?.gas ?? null) : null;
}

export async function readMapFlowsRelease(): Promise<MapFlowsRelease | null> {
  if (!blobEnabled()) {
    return null;
  }
  const store = gasStore();
  const [electricityFile, gasFile] = await Promise.all([
    store.get(MAP_FLOWS_ELECTRICITY, false),
    store.get(MAP_FLOWS_GAS, false),
  ]);
  const electricityPointer = electricityFile ? parseElectricityPointer(electricityFile.body) : null;
  const gasPointer = gasFile ? parseGasPointer(gasFile.body) : null;
  let electricity = electricityPointer?.electricity ?? null;
  let gas = gasPointer?.gas ?? null;
  let capacity = electricityPointer?.capacity ?? null;
  const legacyFile =
    !electricity || !gas || capacity === null ? await store.get(MAP_FLOWS_LATEST, false) : null;
  const legacy = legacyFile ? parseMapFlowsRelease(legacyFile.body) : null;
  electricity = electricity ?? legacy?.electricity ?? null;
  gas = gas ?? legacy?.gas ?? null;
  capacity = capacity ?? legacy?.capacity ?? null;
  if (!electricity && !gas && !capacity) {
    return null;
  }
  const generated = [electricityPointer?.generated_at, gasPointer?.generated_at, legacy?.generated_at]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!generated) {
    return null;
  }
  return { generated_at: generated, electricity, gas, capacity };
}

function revalidateMap(): void {
  try {
    revalidatePath("/map");
  } catch {
    // Scripts and tests have no static generation store.
  }
}

async function putReplacing(pathname: string, previous: string, body: unknown): Promise<void> {
  const store = gasStore();
  const existing = await store.get(pathname, false);
  if (existing) {
    await store.put(previous, existing.body, mutablePut("application/json"));
  }
  await store.put(pathname, `${JSON.stringify(body)}\n`, mutablePut("application/json"));
  revalidateMap();
}

/** Electricity and capacity share one pointer. Gas writes never read or replace this file. */
export async function writeMapElectricityPointer(
  patch: { electricity: ElectricityFlowsRelease; capacity?: CapacityRelease | null },
  now: Date,
): Promise<void> {
  if (!blobEnabled()) {
    return;
  }
  const current = await readElectricityPointer();
  const next: ElectricityPointer = {
    generated_at: now.toISOString(),
    electricity: patch.electricity,
    capacity: patch.capacity !== undefined ? patch.capacity : (current?.capacity ?? null),
  };
  await putReplacing(MAP_FLOWS_ELECTRICITY, MAP_FLOWS_ELECTRICITY_PREVIOUS, next);
}

/** Gas history lives on its own pointer so an electricity publish cannot restore a stale gas block. */
export async function writeMapGasPointer(gas: GasTerminalFlowsRelease, now: Date): Promise<void> {
  if (!blobEnabled()) {
    return;
  }
  const next: GasPointer = { generated_at: now.toISOString(), gas };
  await putReplacing(MAP_FLOWS_GAS, MAP_FLOWS_GAS_PREVIOUS, next);
}

async function fetchJsonRetry(url: string, timeoutMs: number): Promise<unknown> {
  let last: unknown;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchJson(url, {
        timeoutMs,
        headers: { accept: "application/json", "user-agent": "Grid energy-dashboard" },
      });
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

export async function fetchInterconnectorCapacity(now: Date): Promise<CapacityRelease> {
  const sql = `SELECT "Project Name", "Project Status", "Connection Site", "MW Import - Current", "MW Export - Current" FROM "${NESO_INTERCONNECTOR_REGISTER_RESOURCE}" WHERE "Project Status" = 'Built'`;
  const url = `${NESO_CAPACITY_SQL_URL}?sql=${encodeURIComponent(sql)}`;
  const body = await fetchJsonRetry(url, CAPACITY_TIMEOUT_MS);
  const root = body && typeof body === "object" ? (body as { result?: { records?: unknown } }) : {};
  const records = Array.isArray(root.result?.records)
    ? root.result.records.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
  return capacityFromRegister(capacityRowsFromCkan(records), now, now.toISOString());
}

/**
 * Writes `releases/map/flows/latest/electricity.json` from the warmed 24h
 * envelope. A miss leaves the previous file. No Tinybird query.
 */
export async function publishMapElectricity(now: Date): Promise<void> {
  if (!blobEnabled()) {
    return;
  }
  const rows = await peekWarmedPipe<InterconnectorFlow>(
    "interconnector_flows",
    getInterconnectorQueryParams("24h", now),
    { range: "24h", now },
  );
  if (!rows) {
    return;
  }
  const electricity = compactElectricity(rows, now);
  const current = await readElectricityPointer();
  const sameDay = current?.capacity?.generated_at.slice(0, 10) === now.toISOString().slice(0, 10);
  let capacity: CapacityRelease | undefined;
  if (!sameDay) {
    try {
      capacity = await fetchInterconnectorCapacity(now);
    } catch {
      capacity = undefined;
    }
  }
  await writeMapElectricityPointer(capacity ? { electricity, capacity } : { electricity }, now);
}

/** Hourly per-terminal rates. A failed or empty read leaves the previous gas pointer. */
export async function publishMapGasFlows(now: Date): Promise<void> {
  if (!blobEnabled()) {
    return;
  }
  const body = await fetchJsonRetry(GAS_INSTANTANEOUS_URL, GAS_FLOW_TIMEOUT_MS);
  const parsed = parseInstantaneousFlows(body);
  if (parsed.samples.length === 0) {
    return;
  }
  const current = await readGasPointer();
  await writeMapGasPointer(rollGasHistory(current, parsed, now), now);
}
