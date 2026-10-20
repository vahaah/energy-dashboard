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

export const MAP_FLOWS_LATEST = "releases/map/flows/latest.json";
export const MAP_FLOWS_PREVIOUS = "releases/map/flows/previous.json";
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

export async function readMapFlowsRelease(): Promise<MapFlowsRelease | null> {
  if (!blobEnabled()) {
    return null;
  }
  const stored = await gasStore().get(MAP_FLOWS_LATEST, false);
  if (!stored) {
    return null;
  }
  return parseMapFlowsRelease(stored.body);
}

function revalidateMap(): void {
  try {
    revalidatePath("/map");
  } catch {
    // Scripts and tests have no static generation store.
  }
}

export async function mergeMapFlows(
  patch: Partial<Pick<MapFlowsRelease, "electricity" | "gas" | "capacity">>,
  now: Date,
): Promise<void> {
  if (!blobEnabled()) {
    return;
  }
  const current = await readMapFlowsRelease();
  const next: MapFlowsRelease = {
    generated_at: now.toISOString(),
    electricity: patch.electricity !== undefined ? patch.electricity : (current?.electricity ?? null),
    gas: patch.gas !== undefined ? patch.gas : (current?.gas ?? null),
    capacity: patch.capacity !== undefined ? patch.capacity : (current?.capacity ?? null),
  };
  const store = gasStore();
  const existing = await store.get(MAP_FLOWS_LATEST, false);
  if (existing) {
    await store.put(MAP_FLOWS_PREVIOUS, existing.body, mutablePut("application/json"));
  }
  await store.put(MAP_FLOWS_LATEST, `${JSON.stringify(next)}\n`, mutablePut("application/json"));
  revalidateMap();
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
 * Writes the electricity half of `releases/map/flows/latest.json` from the
 * warmed 24h envelope. A miss leaves the previous file. No Tinybird query.
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
  const current = await readMapFlowsRelease();
  const sameDay = current?.capacity?.generated_at.slice(0, 10) === now.toISOString().slice(0, 10);
  let capacity: CapacityRelease | undefined;
  if (!sameDay) {
    try {
      capacity = await fetchInterconnectorCapacity(now);
    } catch {
      capacity = undefined;
    }
  }
  await mergeMapFlows(capacity ? { electricity, capacity } : { electricity }, now);
}

/** Hourly per-terminal rates. A failed or empty read leaves the previous gas block. */
export async function publishMapGasFlows(now: Date): Promise<void> {
  if (!blobEnabled()) {
    return;
  }
  const body = await fetchJsonRetry(GAS_INSTANTANEOUS_URL, GAS_FLOW_TIMEOUT_MS);
  const parsed = parseInstantaneousFlows(body);
  if (parsed.samples.length === 0) {
    return;
  }
  const current = await readMapFlowsRelease();
  await mergeMapFlows({ gas: rollGasHistory(current?.gas ?? null, parsed, now) }, now);
}
